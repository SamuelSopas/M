import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { Shield, Lock, UserPlus, RefreshCw } from 'lucide-react'
import RegistrationModal from '../components/RegistrationModal'
import RequestsModal from '../components/RequestsModal'

export default function Login() {
  const navigate = useNavigate()
  const { adminMaster, setAdminMaster, login, register, usersDB } = useAppContext()

  // 'setup' | 'user-login' | 'master-login'
  const [view, setView] = useState(adminMaster ? 'user-login' : 'setup')

  // Setup form
  const [setupData, setSetupData] = useState({ email: '', password: '', cpf: '' })

  // User login form
  const [userForm, setUserForm] = useState({ 
    id: localStorage.getItem('hub_remember_id') || '', 
    pin: '' 
  })
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('hub_remember_id'))

  // Master login form
  const [masterForm, setMasterForm] = useState({ email: '', password: '' })
  
  // Modal states
  const [isRegModalOpen, setIsRegModalOpen] = useState(false)
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false)

  // ── Setup Master (primeiro acesso) ─────────────────────────────────────
  const handleSetup = () => {
    if (!setupData.email.includes('@')) return alert('E-mail inválido.')
    if (setupData.password.length < 4) return alert('Senha deve ter no mínimo 4 caracteres.')
    if (setupData.cpf.length < 6) return alert('CPF inválido.')
    setAdminMaster({ email: setupData.email, password: setupData.password, cpf: setupData.cpf })
    setView('user-login')
    alert('Admin Master criado! Agora você pode acessar o sistema.')
  }

  // ── Login de usuário comum ─────────────────────────────────────────────
  const handleUserLogin = () => {
    const id = userForm.id.trim().toUpperCase()
    const pin = userForm.pin.trim()

    if (!id || !pin) return alert('Preencha matrícula e PIN.')

    const user = usersDB[id]
    if (!user) return alert('Matrícula não encontrada.')
    if (user.password !== pin) return alert('PIN incorreto.')

    // Verificar bloqueio por trial expirado
    if (user.status === 'trial' && !user.isFav) {
      const created = user.createdAt
      const horasPassadas = created ? (Date.now() - created) / 3600000 : 999
      if (horasPassadas > 72) {
        alert('Seu período trial de 3 dias expirou. Renove sua assinatura.')
        login(id, pin) // loga para redirecionar para pagamento
        navigate('/payment')
        return
      }
    }

    if (user.status === 'blocked' && !user.isFav) {
      alert('Conta bloqueada. Entre em contato com o administrador.')
      return
    }

    // Alerta de expiração próxima (< 7 dias)
    if (user.status === 'active' && !user.isFav && user.createdAt) {
      const limitHours = user.plan === 'anual' ? 365 * 24 : 30 * 24
      const hoursLeft = limitHours - (Date.now() - user.createdAt) / 3600000
      if (hoursLeft <= 0) {
        alert('Sua assinatura expirou. Renove para continuar.')
        login(id, pin)
        navigate('/payment')
        return
      }
      if (hoursLeft <= 168) {
        const dias = Math.floor(hoursLeft / 24)
        alert(`⚠️ Sua assinatura expira em ${dias === 0 ? 'menos de 24 horas' : dias + ' dias'}. Renove em breve!`)
      }
    }

    // Login bem-sucedido
    if (rememberMe) {
      localStorage.setItem('hub_remember_id', id)
    } else {
      localStorage.removeItem('hub_remember_id')
    }
    
    login(id, pin)
    navigate('/dashboard')
  }

  // ── Login Master ───────────────────────────────────────────────────────
  const handleMasterLogin = () => {
    if (!adminMaster) return alert('Nenhum Master cadastrado.')
    if (masterForm.email !== adminMaster.email || masterForm.password !== adminMaster.password) {
      return alert('Credenciais Master incorretas.')
    }
    login('MASTER')
    navigate('/master')
  }

  // ── Recuperação de senha Master ────────────────────────────────────────
  const handlePasswordRecovery = () => {
    if (!adminMaster) return alert('Nenhum Master cadastrado ainda.')
    const email = window.prompt('Informe o e-mail do Master para recuperação:')
    if (!email) return
    if (email.trim() !== adminMaster.email) return alert('E-mail não encontrado.')
    const newPwd = Math.floor(1000 + Math.random() * 9000).toString()
    setAdminMaster({ ...adminMaster, password: newPwd })
    alert(`✅ Senha redefinida!\nNova senha temporária: ${newPwd}\n\nFaça login com ela e altere depois.`)
  }

  const handleRegisterSuccess = (userData) => {
    register(userData)
    setUserForm({ id: userData.id, pin: userData.password })
    setView('user-login')
  }

  const handleRegisterClick = () => {
    setIsRegModalOpen(true)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIEWS
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'setup') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1d1d1f', padding: '2rem' }}>
        <div className="card" style={{ width: '100%', maxWidth: '450px', textAlign: 'center', animation: 'modal-slide-up 0.5s ease' }}>
          <div style={{ marginBottom: '2rem' }}>
             <h1 className="logo-metrics logo-metrics-large" style={{ color: '#fff' }}>metrics</h1>
          </div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: '#fff' }}>Configuração CEO</h2>
          
          <div className="form-group">
            <input className="form-control" placeholder="E-mail Administrativo" value={setupData.email} onChange={e => setSetupData({ ...setupData, email: e.target.value })} />
          </div>
          <div className="form-group">
            <input className="form-control" type="password" placeholder="Senha Master" value={setupData.password} onChange={e => setSetupData({ ...setupData, password: e.target.value })} />
          </div>
          <div className="form-group">
            <input className="form-control" placeholder="CPF para Recuperação" value={setupData.cpf} onChange={e => setSetupData({ ...setupData, cpf: e.target.value })} />
          </div>
          <button className="btn" style={{ width: '100%', marginTop: '1rem', background: '#fff', color: '#000' }} onClick={handleSetup}>
            Ativar Instância
          </button>
        </div>
      </div>
    )
  }

  if (view === 'master-login') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7', padding: '1rem' }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', animation: 'modal-slide-up 0.4s ease' }}>
          <div style={{ marginBottom: '2rem' }}>
             <h1 className="logo-metrics">metrics</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '1.5rem' }}>
             <Lock size={16} color="#86868b" />
             <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Painel Master</h3>
          </div>

          <div className="form-group">
            <input type="email" placeholder="E-mail Admin" className="form-control"
              value={masterForm.email} onChange={e => setMasterForm({ ...masterForm, email: e.target.value })} />
          </div>
          <div className="form-group">
            <input type="password" placeholder="Senha Mestra" className="form-control"
              value={masterForm.password} onChange={e => setMasterForm({ ...masterForm, password: e.target.value })} />
          </div>

          <button className="btn" style={{ width: '100%', background: '#1d1d1f', color: '#fff' }} onClick={handleMasterLogin}>
            Entrar no Hub Master
          </button>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => setView('user-login')}>Voltar</button>
            <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem', color: '#ff3b30' }} onClick={handlePasswordRecovery}>Recuperar</button>
          </div>
        </div>
      </div>
    )
  }

  // ── User login (default) ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7', padding: '1rem', position: 'relative' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', textAlign: 'center', animation: 'modal-slide-up 0.5s ease', padding: '3rem 2rem' }}>
        {/* Logo */}
        <div style={{ marginBottom: '2.5rem' }}>
           <h1 className="logo-metrics logo-metrics-large">metrics</h1>
           <p style={{ fontSize: '0.75rem', letterSpacing: '0.3rem', color: '#86868b', marginTop: '0.5rem', fontWeight: 700 }}>SaaS DASHBOARD v1.1.1</p>
        </div>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <input type="text" placeholder="Matrícula (ex: A-1B2C)" className="form-control"
            style={{ textTransform: 'uppercase', letterSpacing: '0.2rem', textAlign: 'center', fontWeight: 800, fontSize: '1.2rem', padding: '1.2rem' }}
            maxLength={6} value={userForm.id}
            onChange={e => setUserForm({ ...userForm, id: e.target.value.toUpperCase() })}
            onKeyDown={e => e.key === 'Enter' && handleUserLogin()} />
        </div>
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <input type="password" placeholder="PIN de Acesso" className="form-control"
            style={{ letterSpacing: '0.4rem', textAlign: 'center', fontWeight: 800, fontSize: '1.2rem', padding: '1.2rem' }}
            maxLength={4} value={userForm.pin}
            onChange={e => setUserForm({ ...userForm, pin: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && handleUserLogin()} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '2.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#86868b', fontWeight: 600 }}>
          <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ width: '16px', height: '16px' }} />
          Manter Conectado
        </label>

        <button className="btn" style={{ width: '100%', marginBottom: '1.5rem', background: '#1d1d1f', color: '#fff', padding: '1.2rem', fontSize: '1.1rem', borderRadius: '18px', fontWeight: 700 }}
          onClick={handleUserLogin}>
          Entrar no Sistema
        </button>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem', borderRadius: '12px' }} onClick={() => setIsRequestsModalOpen(true)}>
            Solicitações
          </button>
          <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem', borderRadius: '12px' }} onClick={() => setView('master-login')}>
            Área Master
          </button>
        </div>

        <button className="btn btn-secondary" style={{ width: '100%', border: 'none', color: '#007aff', fontSize: '0.9rem', fontWeight: 600 }} onClick={handleRegisterClick}>
          Quero me cadastrar agora
        </button>
      </div>

      <RegistrationModal 
        isOpen={isRegModalOpen} 
        onClose={() => setIsRegModalOpen(false)}
        usersDB={usersDB}
        onRegister={handleRegisterSuccess}
      />

      <RequestsModal
        isOpen={isRequestsModalOpen}
        onClose={() => setIsRequestsModalOpen(false)}
        usersDB={usersDB}
        setUsersDB={setUsersDB}
        currentPixKey={systemSettings?.currentPixKey}
      />
    </div>
  )
}

