import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAppContext } from '../context/AppContext';
import { Clock, CreditCard, Send, CheckCircle, AlertCircle, Calendar, Copy, Heart } from 'lucide-react';
import { parseISO, differenceInSeconds, differenceInHours, differenceInDays, intervalToDuration, formatDuration } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Payment() {
  const { currentUser, appData, setUsersDB, usersDB, systemSettings } = useAppContext();
  
  const [targetId, setTargetId] = useState(currentUser || '');
  const [selectedDays, setSelectedDays] = useState(30);
  const [viewMode, setViewMode] = useState('hours'); // 'hours' | 'days' | 'months' | 'years'
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [requestSent, setRequestSent] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const sub = appData?.subscription || {};
  const isFavorite = appData?.profile?.isFavorite || false;

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (isFavorite) return;
    
    const updateTimer = () => {
      const now = new Date();
      const expiresAt = sub.expiresAt ? parseISO(sub.expiresAt) : null;
      if (!expiresAt) {
        setTimeLeft(0);
        return;
      }
      const diff = differenceInSeconds(expiresAt, now);
      setTimeLeft(diff > 0 ? diff : 0);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [sub.expiresAt, isFavorite]);

  // --- FORMATTER ---
  const renderTime = () => {
    if (isFavorite) return "ACESSO VITALÍCIO ATIVO";
    if (timeLeft <= 0) return "ACESSO EXPIRADO";

    if (viewMode === 'hours') {
      const h = (timeLeft / 3600).toFixed(2);
      return `${h} Horas`;
    }
    if (viewMode === 'days') {
      const d = (timeLeft / 86400).toFixed(1);
      return `${d} Dias`;
    }
    if (viewMode === 'months') {
      const m = (timeLeft / (86400 * 30)).toFixed(1);
      return `${m} Meses`;
    }
    if (viewMode === 'years') {
      const y = (timeLeft / (86400 * 365)).toFixed(2);
      return `${y} Anos`;
    }
    return "";
  };

  const handleRequestTime = () => {
    const tid = targetId.trim().toUpperCase();
    if (!tid) return alert('Informe a matrícula de destino.');
    if (!usersDB[tid]) return alert('Matrícula não encontrada no sistema.');

    // Update usersDB with the request
    setUsersDB(prev => ({
      ...prev,
      [tid]: {
        ...prev[tid],
        status: 'pending',
        timeRequest: {
          days: selectedDays,
          requestedAt: Date.now(),
          receipt: receipt // base64 string
        }
      }
    }));

    setReceipt(null);
    setRequestSent(true);
    setTimeout(() => setRequestSent(false), 5000);
    alert(`Solicitação de +${selectedDays} dias enviada para a matrícula ${tid}. Aguarde aprovação do Master.`);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Arquivo muito grande. Limite de 2MB para comprovantes.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceipt(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Layout title="Assinatura e Tempo" subtitle="Gestão de acesso e faturamento dinâmico">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* CRONÔMETRO */}
        <div className="card" style={{ 
          background: timeLeft <= 3600 && !isFavorite ? 'rgba(255,59,48,0.1)' : 'var(--bg-color)',
          border: timeLeft <= 3600 && !isFavorite ? '2px solid #ff3b30' : '1px solid var(--border-color)',
          textAlign: 'center',
          padding: '2rem'
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1rem', marginBottom: '0.5rem', fontWeight: 700 }}>
             {isFavorite ? 'Status Especial' : `Você tem ${renderTime()} de acesso`}
          </div>
          
          <div style={{ fontSize: '3rem', fontWeight: '800', color: timeLeft <= 3600 && !isFavorite ? '#ff3b30' : 'var(--text-main)', margin: '0.5rem 0' }}>
            {renderTime()}
          </div>

          {!isFavorite && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <button className={`btn btn-secondary ${viewMode === 'hours' ? 'active' : ''}`} style={{ fontSize: '0.7rem', padding: '4px 10px' }} onClick={() => setViewMode('hours')}>H</button>
              <button className={`btn btn-secondary ${viewMode === 'days' ? 'active' : ''}`} style={{ fontSize: '0.7rem', padding: '4px 10px' }} onClick={() => setViewMode('days')}>D</button>
              <button className={`btn btn-secondary ${viewMode === 'months' ? 'active' : ''}`} style={{ fontSize: '0.7rem', padding: '4px 10px' }} onClick={() => setViewMode('months')}>M</button>
              <button className={`btn btn-secondary ${viewMode === 'years' ? 'active' : ''}`} style={{ fontSize: '0.7rem', padding: '4px 10px' }} onClick={() => setViewMode('years')}>A</button>
            </div>
          )}
        </div>

        {/* COMPRAR TEMPO */}
        <div className="card" style={{ borderTop: '4px solid #007aff' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
             <Calendar size={20} color="#007aff" />
             <h3 style={{ margin: 0 }}>Comprar Tempo de Acesso</h3>
           </div>
           
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              <b>Adquira acesso para você ou para algum amigo.</b><br/> 
              Escolha o tempo desejado, informe o ID e confirme. O Master receberá sua solicitação imediatamente.
              <span style={{ display: 'block', fontSize: '0.65rem', marginTop: '4px', opacity: 0.8 }}>quer ajudar esse projeto? compre tempo</span>
            </p>

           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">ID de Destino (Matrícula)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ex: 4A7X" 
                  value={targetId} 
                  onChange={e => setTargetId(e.target.value.toUpperCase())}
                  maxLength={4}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tempo Adicional</label>
                <select className="form-control" value={selectedDays} onChange={e => setSelectedDays(parseInt(e.target.value))}>
                  <option value={30}>+30 Dias (01 Mês)</option>
                  <option value={60}>+60 Dias (02 Meses)</option>
                  <option value={90}>+90 Dias (03 Meses)</option>
                  <option value={120}>+120 Dias (04 Meses)</option>
                  <option value={150}>+150 Dias (05 Meses)</option>
                  <option value={180}>+180 Dias (06 Meses)</option>
                  <option value={365}>+365 Dias (01 Ano)</option>
                </select>
              </div>
           </div>

           <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={14} color={receipt ? "#30d158" : "#86868b"} />
                Anexar Comprovante (Opcional, mas agiliza a liberação)
              </label>
              <input 
                type="file" 
                className="form-control" 
                accept="image/*"
                onChange={handleFileChange}
                style={{ fontSize: '0.8rem', padding: '0.5rem' }}
              />
              {receipt && <div style={{ fontSize: '0.7rem', color: '#30d158', marginTop: '4px' }}>✓ Comprovante anexado com sucesso.</div>}
           </div>

           <button className="btn" style={{ width: '100%', background: '#007aff', color: '#fff', fontSize: '1rem', padding: '0.8rem' }} onClick={handleRequestTime}>
              <Send size={18} style={{ marginRight: '8px' }} /> Enviar Solicitação para Master
           </button>

           {requestSent && (
             <div style={{ marginTop: '1rem', textAlign: 'center', color: '#30d158', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <CheckCircle size={16} /> Pedido enviado com sucesso!
             </div>
           )}
        </div>

        {/* INFORMAÇÕES PIX */}
        <div className="card" style={{ background: '#f5f5f7', border: '1px dashed #d2d2d7' }}>
          <h4 style={{ margin: '0 0 0.5rem 0' }}>💡 Próximos Passos</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Após clicar em enviar solicitação, o sistema Master entrará em modo de aguardo. 
            Realize o pagamento via PIX para o código abaixo e envie o comprovante para seu contato oficial.
            Assim que confirmado, suas horas serão liberadas.
          </p>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ flex: 1, background: '#fff', border: '1px solid #d2d2d7', padding: '0.6rem', borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {systemSettings?.currentPixKey || 'Chave Não Definida'}
            </div>
            <button className="btn" style={{ padding: '0.6rem', background: '#1d1d1f' }} onClick={() => {
              if (systemSettings?.currentPixKey) {
                navigator.clipboard.writeText(systemSettings.currentPixKey);
                alert('Código PIX copiado!');
              }
            }}>
              <Copy size={16} />
            </button>
          </div>
        </div>

        {/* MENSAGEM DE LEALDADE */}
        <div style={{ textAlign: 'center', marginTop: '1rem', padding: '1rem', borderTop: '1px solid #eee' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Heart size={14} color="#ff3b30" fill="#ff3b30" />
            <span>Você já passou <b>{sub.totalHoursBought || 0} horas</b> conosco! Obrigado por ajudar no desenvolvimento!</span>
          </div>
        </div>

      </div>
      
      <style>{`
        .btn.active { 
          background: var(--text-main) !important; 
          color: #fff !important;
          border-color: var(--text-main) !important;
        }
      `}</style>
    </Layout>
  );
}
