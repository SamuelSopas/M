import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home as HomeIcon, Smartphone, User, LogOut, X, Play } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { differenceInHours, parseISO } from 'date-fns';
import OnboardingVideoModal from './OnboardingVideoModal';

export default function Layout({ title, subtitle, children }) {
  const navigate = useNavigate();
  const { logout, currentUser, usersDB, appData, systemSettings } = useAppContext();
  const [isBannerHidden, setIsBannerHidden] = useState(localStorage.getItem('SG_trialBannerHidden') === 'true');
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Show onboarding video only once per session
    const hasSeen = sessionStorage.getItem('metrics_seen_onboarding');
    if (systemSettings?.activeVideoId && !hasSeen && currentUser && currentUser !== 'MASTER') {
      setShowOnboarding(true);
    }
  }, [systemSettings, currentUser]);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    sessionStorage.setItem('metrics_seen_onboarding', 'true');
  };

  const user = usersDB[currentUser];
  const isTrial = user?.status === 'trial' && !user?.isFav;

  const now = new Date();
  const expiresAt = appData?.subscription?.expiresAt ? parseISO(appData.subscription.expiresAt) : null;
  const hoursLeft = expiresAt ? differenceInHours(expiresAt, now) : 72;

  // Re-show banner if < 1h remains
  const forceShow = hoursLeft <= 1;

  const getRemainingTrialTime = () => {
    if (!user?.createdAt) return null;
    const limit = 72 * 3600000; // 3 days
    const diff = limit - (Date.now() - user.createdAt);
    if (diff <= 0) return 'Expirado';
    
    const days = Math.floor(diff / (24 * 3600000));
    const hours = Math.floor((diff % (24 * 3600000)) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const toggleSimulatedViewport = () => {
    document.body.classList.toggle('is-mobile');
  };

  return (
    <div className="hub-container">
      {isTrial && (!isBannerHidden || forceShow) && (
        <div 
          style={{ 
            background: 'linear-gradient(90deg, #ff9500 0%, #ffcc00 100%)', 
            color: '#fff', 
            padding: '8px 1rem', 
            textAlign: 'center', 
            fontSize: '0.8rem', 
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            position: 'relative'
          }}
        >
          <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => navigate('/payment')}>
            🎁 MODO TRIAL ATIVO: Você tem {getRemainingTrialTime()} de acesso gratuito restante. CLIQUE AQUI PARA ASSINAR.
          </div>
          {!forceShow && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsBannerHidden(true);
                localStorage.setItem('SG_trialBannerHidden', 'true');
              }}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      <header className="dashboard-header" style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', height: '50px' }}>
          <button className="btn btn-secondary" style={{ borderColor: 'transparent', padding: '0.5rem' }} onClick={() => navigate('/dashboard')}>
            <HomeIcon size={20} color="var(--text-main)" />
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', borderColor: 'transparent' }} title="Desktop/Mobile Toggle" onClick={toggleSimulatedViewport}><Smartphone size={14} /></button>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', borderColor: 'transparent' }} onClick={() => navigate('/profile')}><User size={14} /></button>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', borderColor: 'transparent', color: 'var(--danger-color)' }} onClick={logout}><LogOut size={14} /></button>
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '0.8rem 0 1.5rem 0' }}>
          <div className="logo-metrics" style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>
            metrics
          </div>
          
          <h2 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '0', textTransform: 'uppercase', letterSpacing: '0.05rem', fontWeight: '700' }}>{title}</h2>
          {subtitle && <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>{subtitle}</p>}
        </div>
      </header>
      <main className="main-content">
        {children}
      </main>

      {showOnboarding && (
        <OnboardingVideoModal 
          activeVideoId={systemSettings.activeVideoId} 
          onClose={handleCloseOnboarding} 
        />
      )}
    </div>
  );
}
