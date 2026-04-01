import React, { useState, useEffect } from 'react';
import { Shield, X, User, Mail, Phone, Lock, CreditCard } from 'lucide-react';

export default function RegistrationModal({ isOpen, onClose, usersDB, onRegister }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    pin: ''
  });
  const [matricula, setMatricula] = useState('');

  useEffect(() => {
    if (isOpen) {
      generateMatricula();
    }
  }, [isOpen]);

  const generateMatricula = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    while (true) {
      const prefix = chars.charAt(Math.floor(Math.random() * 26)); // Letra aleatória
      let randomPart = '';
      for (let i = 0; i < 4; i++) randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
      result = `${prefix}-${randomPart}`;
      if (!usersDB[result]) break;
    }
    setMatricula(result);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone || formData.pin.length !== 4) {
      return alert('Por favor, preencha todos os campos obrigatórios e um PIN de 4 dígitos.');
    }

    const userData = {
      id: matricula,
      password: formData.pin,
      status: 'trial',
      plan: 'mensal', // Default trial plan
      createdAt: Date.now(),
      profile: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        cpf: formData.cpf,
        bloodType: '',
        customFields: [],
        isFavorite: false
      }
    };

    onRegister(userData);
    alert(`✅ Conta Criada!\nMatrícula: ${matricula}\nPIN: ${formData.pin}\n\nAguarde, estamos preparando seu ambiente.`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="overlay">
      <div className="modal-content">
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#86868b' }}>
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: 48, height: 48, background: '#1d1d1f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Shield size={24} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1d1d1f' }}>Crie sua Conta SaaS</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Fornecemos um período de experimentação sem limites por <span style={{ fontWeight: 700, color: '#1d1d1f' }}>3 Dias</span> logo após concluir o fluxo.
          </p>
        </div>

        <div className="matricula-card">
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.1rem' }}>Matrícula (Anote-a)</div>
          <div className="matricula-value">{matricula}</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nome Completo</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#86868b' }} />
              <input 
                type="text" 
                className="form-control" 
                style={{ paddingLeft: '40px' }} 
                placeholder="Ex: Elias Costa"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#86868b' }} />
                <input 
                  type="email" 
                  className="form-control" 
                  style={{ paddingLeft: '40px' }} 
                  placeholder="@email.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Telefone (Whatsapp)</label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#86868b' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ paddingLeft: '40px' }} 
                  placeholder="(DDD) 9..."
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">CPF (Opcional)</label>
              <div style={{ position: 'relative' }}>
                <CreditCard size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#86868b' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ paddingLeft: '40px' }} 
                  placeholder="000.000.000-00"
                  value={formData.cpf}
                  onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Senha da Conta (4 Números)</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#86868b' }} />
                <input 
                  type="password" 
                  className="form-control" 
                  style={{ paddingLeft: '40px', letterSpacing: '0.3rem', fontWeight: 800 }} 
                  placeholder="••••"
                  maxLength={4}
                  value={formData.pin}
                  onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn" 
            style={{ width: '100%', marginTop: '1rem', background: '#1d1d1f', color: '#fff', padding: '1rem', borderRadius: '14px', fontSize: '1rem', fontWeight: 600 }}
          >
            Criar Conta e Iniciar 3 Dias Trial
          </button>

          <button 
            type="button" 
            onClick={onClose} 
            style={{ width: '100%', marginTop: '1rem', background: 'none', border: 'none', color: '#ff3b30', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 500 }}
          >
            Cancelar Inscrição
          </button>
        </form>
      </div>
    </div>
  );
}
