import React, { useState } from 'react';
import { X, MessageSquare, Send, DollarSign, Image as ImageIcon, CheckCircle } from 'lucide-react';

export default function RequestsModal({ isOpen, onClose, usersDB, setUsersDB, currentPixKey }) {
  const [step, setStep] = useState(1); // 1: Auth, 2: Form, 3: Success
  const [auth, setAuth] = useState({ id: '', pin: '' });
  const [formData, setFormData] = useState({ type: 'Geral', msg: '', receipt: null });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAuth = () => {
    const id = auth.id.trim().toUpperCase();
    const pin = auth.pin.trim();
    if (!usersDB[id]) return alert('Matrícula não encontrada.');
    if (usersDB[id].password !== pin) return alert('PIN incorreto.');
    setStep(2);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setFormData({ ...formData, receipt: reader.result });
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (formData.msg.length > 150) return alert('Mensagem muito longa (máx 150 caracteres).');
    if (formData.type === 'Pagamento' && !formData.receipt) return alert('Por favor, anexe o comprovante do PIX.');

    setIsSubmitting(true);

    const userId = auth.id.trim().toUpperCase();

    // Lógica de Auto-Liberação se for Pagamento
    if (formData.type === 'Pagamento' && formData.receipt) {
      const now = Date.now();
      setUsersDB(prev => {
        const u = prev[userId];
        const currentExp = u.appData?.subscription?.expiresAt ? new Date(u.appData.subscription.expiresAt).getTime() : now;
        const baseTime = currentExp > now ? currentExp : now;
        const newExp = new Date(baseTime + (30 * 24 * 3600000)); // +30 dias padrão

        return {
          ...prev,
          [userId]: {
            ...u,
            status: 'active',
            paidAt: now,
            timeRequest: { days: 30, receipt: formData.receipt, note: formData.msg, date: now },
            appData: {
              ...u.appData,
              subscription: {
                ...(u.appData?.subscription || {}),
                status: 'active',
                expiresAt: newExp.toISOString()
              }
            }
          }
        };
      });
    } else {
      // Pedido comum (apenas registra no user para o admin ver)
      setUsersDB(prev => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          lastRequest: { type: formData.type, msg: formData.msg, date: Date.now() }
        }
      }));
    }

    setTimeout(() => {
      setIsSubmitting(false);
      setStep(3);
    }, 1000);
  };

  return (
    <div className="overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#86868b' }}>
          <X size={20} />
        </button>

        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: 48, height: 48, background: 'rgba(0,122,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <MessageSquare size={24} color="#007aff" />
              </div>
              <h3>Central de Solicitações</h3>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>Identifique-se para prosseguir.</p>
            </div>
            <div className="form-group">
              <input className="form-control" placeholder="Matrícula" value={auth.id} onChange={e => setAuth({...auth, id: e.target.value.toUpperCase()})} />
            </div>
            <div className="form-group">
              <input className="form-control" type="password" placeholder="PIN" value={auth.pin} onChange={e => setAuth({...auth, pin: e.target.value})} />
            </div>
            <button className="btn" style={{ width: '100%', background: '#1d1d1f' }} onClick={handleAuth}>Entrar no Portal</button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Nova Solicitação</h3>
            <div className="form-group">
              <label className="form-label">Tipo de Pedido</label>
              <select className="form-control" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="Geral">Pergunta / Dúvida</option>
                <option value="Suporte">Problema Técnico</option>
                <option value="Pagamento">Solicitar Liberação (via PIX)</option>
              </select>
            </div>

            {formData.type === 'Pagamento' && (
              <div style={{ background: '#f5f5f7', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid #e5e5ea' }}>
                <div style={{ fontSize: '0.7rem', color: '#86868b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>Chave PIX (Tesouraria)</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.8rem', color: '#007aff' }}>{currentPixKey || 'Não configurada'}</div>
                
                <label className="btn btn-secondary" style={{ width: '100%', cursor: 'pointer', fontSize: '0.8rem', gap: '8px' }}>
                  <ImageIcon size={14} /> {formData.receipt ? 'Alterar Comprovante' : 'Anexar Comprovante'}
                  <input type="file" hidden accept="image/*" onChange={handleFile} />
                </label>
                {formData.receipt && <div style={{ fontSize: '0.65rem', color: '#30d158', marginTop: '5px', textAlign: 'center' }}>✓ Imagem anexada com sucesso</div>}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Observações (Opcional)</label>
              <textarea 
                className="form-control" 
                rows={3} 
                maxLength={150}
                placeholder="Descreva seu pedido..."
                value={formData.msg}
                onChange={e => setFormData({...formData, msg: e.target.value})}
              />
              <div style={{ textAlign: 'right', fontSize: '0.65rem', color: '#86868b', marginTop: '3px' }}>{formData.msg.length}/150</div>
            </div>

            <button className="btn" style={{ width: '100%', background: '#1d1d1f' }} onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Processando...' : 'Enviar Solicitação'}
            </button>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <CheckCircle size={48} color="#30d158" style={{ marginBottom: '1rem' }} />
            <h3 style={{ color: '#1d1d1f' }}>Solicitação Enviada!</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {formData.type === 'Pagamento' 
                ? 'Seu acesso foi LIBERADO automaticamente. Você já pode logar no sistema.' 
                : 'Seu pedido foi registrado. O administrador responderá em breve.'}
            </p>
            <button className="btn" style={{ width: '100%', background: '#1d1d1f' }} onClick={onClose}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}
