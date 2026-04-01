import React, { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import Layout from '../components/Layout'
import { Plus, Trash2, Save, Fingerprint, Eye, EyeOff, ShieldCheck, RefreshCw } from 'lucide-react'
export default function Profile() {
  const { appData, updateAppData, updateProfile, usersDB, currentUser, setUsersDB, currentUserPin, setCurrentUserPin } = useAppContext()
  const [profile, setProfile] = useState(appData?.profile || { customFields: [] })
  const [isAdding, setIsAdding] = useState(false)
  const [newField, setNewField] = useState({ key: '', value: '' })
  const [showPassword, setShowPassword] = useState(false)

  const userEntry = usersDB[currentUser] || {}

  const changePin = () => {
    const newPin = prompt('Digite seu novo PIN de acesso (4 números):');
    if (newPin === null) return;
    if (newPin.length !== 4 || isNaN(newPin)) {
      alert('O PIN deve ter exatamente 4 números.');
      return;
    }

    setUsersDB(prev => ({
      ...prev,
      [currentUser]: {
        ...prev[currentUser],
        password: newPin
      }
    }));
    
    setCurrentUserPin(newPin);
    alert('PIN alterado com sucesso!');
  }

  if (!appData) return <div>Carregando...</div>

  const handleAddField = () => {
    if (!newField.key) return alert('Dê um nome para a categoria.')
    const updated = {
      ...profile,
      customFields: [...(profile.customFields || []), newField]
    }
    setProfile(updated)
    setNewField({ key: '', value: '' })
    setIsAdding(false)
  }

  const handleRemoveField = (index) => {
    const updated = {
      ...profile,
      customFields: profile.customFields.filter((_, i) => i !== index)
    }
    setProfile(updated)
  }

  const handleSave = () => {
    updateProfile(profile)
    alert('Dados Gravados com Sucesso!')
  }

  return (
    <Layout title="Sobre o Usuário" subtitle="Seu ecossistema privado de identidade">
      <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.03 }}>
          <Fingerprint size={150} />
        </div>

        <h3 className="card-title">Informações Essenciais</h3>
        <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>Identidade central vinculada ao banco de dados.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', padding: '0.6rem 1rem', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.7rem', color: '#86868b', fontWeight: '600', display: 'block', marginBottom: '0.2rem', textTransform: 'uppercase' }}>Sua Matrícula (ID)</span>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-color)', letterSpacing: '2px' }}>{currentUser}</div>
          </div>
          <div style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', padding: '0.6rem 1rem', borderRadius: '10px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '0.7rem', color: '#86868b', fontWeight: '600', textTransform: 'uppercase' }}>PIN de Acesso</span>
              <button 
                onClick={changePin}
                style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer', padding: '0' }}
              >
                ALTERAR
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', fontFamily: 'monospace', letterSpacing: '4px' }}>
                {showPassword ? (userEntry.password || '****') : '****'}
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ border: 'none', background: 'transparent', padding: '0', color: '#86868b' }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', padding: '0.6rem 1rem', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.7rem', color: '#86868b', fontWeight: '600', display: 'block', marginBottom: '0.2rem', textTransform: 'uppercase' }}>Nome Visível</span>
            <input type="text" style={{ width: '100%', border: 'none', background: 'transparent', color: '#1d1d1f', outline: 'none', fontSize: '1rem', fontWeight: '500' }} value={profile.name || ''} onChange={(e) => setProfile({...profile, name: e.target.value})} placeholder="Seu nome" />
          </div>
          
          <div style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', padding: '0.6rem 1rem', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.7rem', color: '#86868b', fontWeight: '600', display: 'block', marginBottom: '0.2rem', textTransform: 'uppercase' }}>E-mail Pessoal</span>
            <input type="email" style={{ width: '100%', border: 'none', background: 'transparent', color: '#1d1d1f', outline: 'none', fontSize: '1rem', fontWeight: '500' }} value={profile.email || ''} onChange={(e) => setProfile({...profile, email: e.target.value})} placeholder="seu@email.com" />
          </div>

          <div style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', padding: '0.6rem 1rem', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.7rem', color: '#86868b', fontWeight: '600', display: 'block', marginBottom: '0.2rem', textTransform: 'uppercase' }}>Tipo Sanguíneo</span>
            <input type="text" style={{ width: '100%', border: 'none', background: 'transparent', color: '#1d1d1f', outline: 'none', fontSize: '1rem', fontWeight: '500' }} value={profile.bloodType || ''} onChange={(e) => setProfile({...profile, bloodType: e.target.value})} placeholder="Ex: O+" />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <div>
            <h3 className="card-title">Categorias Adicionais</h3>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Campos dinâmicos e adaptáveis.</p>
          </div>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setIsAdding(true)}>
            <Plus size={14} style={{ marginRight: '4px' }} /> Novo Campo
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {(profile.customFields || []).length === 0 && <div className="text-muted" style={{ textAlign: 'center', padding: '2rem', border: '1px dashed #d2d2d7', borderRadius: '12px', fontSize: '0.9rem' }}>Nenhum campo adicional cadastrado.</div>}
          {profile.customFields?.map((f, i) => (
            <div key={i} style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', padding: '0.6rem 1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.7rem', color: '#86868b', fontWeight: '600', display: 'block', marginBottom: '0.2rem', textTransform: 'uppercase' }}>{f.key}</span>
                <input type="text" style={{ width: '100%', border: 'none', background: 'transparent', color: '#1d1d1f', outline: 'none', fontSize: '1rem', fontWeight: '500' }} value={f.value} onChange={(e) => {
                  const updated = [...profile.customFields]
                  updated[i].value = e.target.value
                  setProfile({ ...profile, customFields: updated })
                }} />
              </div>
              <button className="btn btn-secondary" style={{ border: 'none', color: '#ff3b30', background: 'transparent', padding: '4px' }} onClick={() => handleRemoveField(i)}>
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>

        {isAdding && (
          <div style={{ background: 'rgba(0,122,255,0.05)', border: '1px dashed #007aff', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#007aff', marginBottom: '0.5rem' }}>Nova Categoria</h4>
            <input type="text" className="form-control" placeholder="Título (Ex: Linkedin)" style={{ marginBottom: '0.5rem' }} value={newField.key} onChange={(e) => setNewField({...newField, key: e.target.value})} />
            <input type="text" className="form-control" placeholder="Valor" style={{ marginBottom: '1rem' }} value={newField.value} onChange={(e) => setNewField({...newField, value: e.target.value})} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsAdding(false)}>Cancelar</button>
              <button className="btn" style={{ flex: 1, background: '#007aff' }} onClick={handleAddField}>Incluir</button>
            </div>
          </div>
        )}

        <button className="btn" style={{ width: '100%', background: '#007aff' }} onClick={handleSave}>
          <Save size={18} style={{ marginRight: '8px' }} /> Gravar Dossiê
        </button>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </Layout>
  )
}
