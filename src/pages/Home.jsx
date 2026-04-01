import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { CheckSquare, DollarSign, BookOpen, Activity, Library, CreditCard, Fingerprint, AlertTriangle, Shield, X } from 'lucide-react'
import { differenceInHours, parseISO, differenceInDays } from 'date-fns'
import Layout from '../components/Layout'

export default function Home() {
  const { appData, currentUser } = useAppContext()
  const navigate = useNavigate()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAlertHidden, setIsAlertHidden] = useState(localStorage.getItem('metrics_homeAlertHidden') === 'true')

  // Master goes straight to the master panel
  useEffect(() => {
    if (currentUser === 'MASTER') navigate('/master', { replace: true })
  }, [currentUser])

  const generateCarouselItems = () => {
    if (!appData) return []
    const items = []
    
    // Real balance
    let total = 0
    appData.transactionsBuffer.forEach(t => total += (t.type === 'income' ? t.amount : -t.amount))
    items.push({
      title: '📈 Minha Carteira Virtual',
      value: `R$ ${total.toFixed(2)}`,
      color: 'var(--text-main)'
    })

    // Books
    items.push({
      title: '📚 Minha Estante',
      value: `${appData.booksBuffer.length} Livros`,
      color: 'var(--accent-color)'
    })

    // Studies
    items.push({
      title: '🧠 Trilhas de Sabedoria',
      value: `${appData.studiesBuffer.length} Cursos`,
      color: '#007aff'
    })

    return items
  }

  const slides = generateCarouselItems()

  const sub = appData?.subscription || {}
  const now = new Date()
  const expiresAt = sub.expiresAt ? parseISO(sub.expiresAt) : null
  const isFavorite = appData?.profile?.isFavorite || false
  
  const hoursLeft = expiresAt ? differenceInHours(expiresAt, now) : 0
  const daysLeft = expiresAt ? differenceInDays(expiresAt, now) : 0
  const isExpired = hoursLeft <= 0 && !isFavorite

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % (slides.length || 1))
    }, 4000)
    return () => clearInterval(timer)
  }, [slides.length])

  if (!appData) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#86868b', fontSize: '0.9rem' }}>
      Carregando dados...
    </div>
  )

  return (
    <Layout title="Dashboard" subtitle="Métricas e Inteligência Social">
      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
        
        {/* NOTIFICAÇÃO DE ASSINATURA */}
        {!isFavorite && (isExpired || daysLeft <= 7) && (!isAlertHidden || hoursLeft <= 1) && (
          <div style={{ 
            background: isExpired ? 'var(--danger-color)' : '#ff9500',
            color: '#fff',
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: 'var(--shadow-md)',
            position: 'relative'
          }}>
            <AlertTriangle size={24} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold' }}>{isExpired ? 'ACESSO BLOQUEADO' : 'ATENÇÃO: SUA ASSINATURA VENCERÁ EM BREVE'}</div>
              <div style={{ fontSize: '0.85rem' }}>
                {isExpired 
                  ? 'Seu período de acesso expirou. Regularize via PIX para continuar.' 
                  : `Restam apenas ${daysLeft} dias (${hoursLeft} horas) de acesso. Evite o bloqueio.`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button className="btn" style={{ background: '#fff', color: isExpired ? 'var(--danger-color)' : '#ff9500', fontSize: '0.8rem' }} onClick={() => navigate('/payment')}>
                Resolver Agora
              </button>
              {(hoursLeft > 1 && !isExpired) && (
                <button 
                  onClick={() => {
                    setIsAlertHidden(true);
                    localStorage.setItem('metrics_homeAlertHidden', 'true');
                  }}
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '5px' }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        )}

        {isFavorite && (
          <div style={{ background: 'rgba(0,122,255,0.1)', border: '1px solid #007aff', color: '#007aff', padding: '0.8rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
             <Fingerprint size={20} />
             <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>STATUS: USUÁRIO FAVORITO (Acesso Ilimitado Concedido pelo Master)</div>
          </div>
        )}

        {currentUser === 'MASTER' && (
          <div className="card nav-card" style={{ border: '2px solid var(--text-main)', marginBottom: '1.5rem', background: '#f8f9fa' }} onClick={() => navigate('/master')}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'center' }}>
                <Shield size={24} color="var(--text-main)" />
                <h3 style={{ margin: 0 }}>ENTRAR NO PAINEL MASTER (CEO)</h3>
             </div>
          </div>
        )}

        {/* CARROSSEL INTELIGENTE */}
        <div className="card" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid var(--border-color)', overflow: 'hidden', position: 'relative', minHeight: '140px', justifyContent: 'center' }}>
          {slides.map((s, i) => (
            <div key={i} className="carousel-slide" style={{ 
              textAlign: 'center', 
              padding: '1.5rem', 
              display: i === currentSlide ? 'block' : 'none',
              animation: 'fadeIn 0.5s ease-in-out'
            }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05rem', textTransform: 'uppercase' }}>{s.title}</h3>
              <p style={{ fontSize: '2.2rem', fontWeight: '700', color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* NAVEGAÇÃO GRID */}
        <nav className="home-nav-grid" style={{ marginTop: '2rem' }}>
          <div className="card nav-card" onClick={() => navigate('/habits')} style={{ cursor: 'pointer' }}>
            <CheckSquare size={32} style={{ margin: '0 auto 0.5rem' }} />
            <h3>Hábitos</h3>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Constância & Rotina</p>
          </div>

          <div className="card nav-card" onClick={() => navigate('/finance')}>
            <DollarSign size={32} style={{ margin: '0 auto 0.5rem' }} />
            <h3>Finanças</h3>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Fluxo & Carteira</p>
          </div>

          <div className="card nav-card" onClick={() => navigate('/studies')}>
            <BookOpen size={32} style={{ margin: '0 auto 0.5rem' }} />
            <h3>Estudos</h3>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Trilhas de Cursos</p>
          </div>

          <div className="card nav-card" onClick={() => navigate('/running')}>
             <Activity size={32} style={{ margin: '0 auto 0.5rem', color: '#ff3b30' }} />
            <h3>Corrida</h3>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Tracker & Pace</p>
          </div>

          <div className="card nav-card" onClick={() => navigate('/books')}>
            <Library size={32} style={{ margin: '0 auto 0.5rem' }} />
            <h3>Livros</h3>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Acervo Social</p>
          </div>

          <div className="card nav-card" onClick={() => navigate('/profile')}>
            <Fingerprint size={32} style={{ margin: '0 auto 0.5rem', color: '#ff9500' }} />
            <h3>Sobre Usuário</h3>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Dossiê Pessoal Completo</p>
          </div>

          <div className="card nav-card" style={{ border: '2px dashed rgba(0, 122, 255, 0.4)' }} onClick={() => navigate('/payment')}>
            <CreditCard size={32} style={{ margin: '0 auto 0.5rem', color: '#007aff' }} />
            <h3>Assinatura e Tempo</h3>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Gestão e PIX</p>
          </div>
        </nav>

      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Layout>
  )
}
