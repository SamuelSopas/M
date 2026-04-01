import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import Layout from '../components/Layout'
import {
  Users, UserPlus, ShieldCheck, Star, Trash2, Search,
  RefreshCw, Lock, Unlock, Eye, X, LogIn, DollarSign,
  Tag, AlertTriangle, CheckCircle, Clock, Zap, FileText,
  Video, Play, Check, Plus
} from 'lucide-react'
import { saveVideoBlob, deleteVideoBlob } from '../utils/videoDB'

// ─── helpers ────────────────────────────────────────────────────────────────
function generateMatricula(db, prefix = 'A') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  const cleanPrefix = prefix.toUpperCase().charAt(0) || 'A'
  while (true) {
    let randomPart = ''
    for (let i = 0; i < 4; i++) randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
    result = `${cleanPrefix}-${randomPart}`
    if (!db[result]) break
  }
  return result
}
function generatePwd() { return Math.floor(1000 + Math.random() * 9000).toString() }

function getExpirationInfo(user) {
  if (user.isFav) return { label: 'VIP Vitalício ⭐', color: '#ff9500' }
  if (user.status === 'blocked') return { label: 'Bloqueado', color: '#ff3b30' }
  if (!user.createdAt) return { label: 'Status Imaturo', color: '#86868b' }
  const now = Date.now()
  let limitHours = 24
  if (user.status === 'active') limitHours = (user.plan === 'anual') ? 365 * 24 : 30 * 24
  const origin = (user.status === 'pending' && user.pendingAt) ? user.pendingAt : user.createdAt
  const hoursLeft = limitHours - (now - origin) / 3600000
  if (hoursLeft <= 0) return { label: 'Prazo Estourado', color: '#ff3b30' }
  const days = Math.floor(hoursLeft / 24)
  const hrs = Math.floor(hoursLeft % 24)
  const mins = Math.floor((hoursLeft * 60) % 60)
  if (days > 0) return { label: `${days}d ${hrs}h restantes`, color: '#30d158' }
  return { label: `${hrs}h ${mins}m restantes`, color: hoursLeft < 3 ? '#ff3b30' : '#ff9500' }
}

const STATUS_WEIGHT = { pending: 0, trial: 1, active: 2, blocked: 3 }

// ─── component ───────────────────────────────────────────────────────────────
export default function MasterDashboard() {
  const navigate = useNavigate()
  const { usersDB, setUsersDB, adminMaster, systemSettings, setSystemSettings, login } = useAppContext()

  // Search
  const [searchTerm, setSearchTerm] = useState('')

  // Create user form
  const [newUser, setNewUser] = useState({ name: '', id: '', password: '', prefix: 'A' })

  // PIX & Prices
  const [pixKey, setPixKey] = useState(systemSettings?.currentPixKey || '')
  const [priceMonthly, setPriceMonthly] = useState(systemSettings?.planPrices?.monthly ?? 5)
  const [priceAnnual, setPriceAnnual] = useState(systemSettings?.planPrices?.annual ?? 50)
  const [isPromo, setIsPromo] = useState(systemSettings?.isPromo ?? false)

  const [modalUser, setModalUser] = useState(null)
  const [editData, setEditData] = useState({})
  
  // CEO Popups
  const [approvalHistory, setApprovalHistory] = useState(systemSettings?.approvalHistory || [])
  const [actionPopup, setActionPopup] = useState(null) // { title: '', msg: '', type: 'success' | 'danger' }

  // Sync from context
  useEffect(() => {
    setPixKey(systemSettings?.currentPixKey || '')
    setPriceMonthly(systemSettings?.planPrices?.monthly ?? 5)
    setPriceAnnual(systemSettings?.planPrices?.annual ?? 50)
    setIsPromo(systemSettings?.isPromo ?? false)
    if (systemSettings?.approvalHistory) {
      setApprovalHistory(systemSettings.approvalHistory)
    }
  }, [systemSettings])

  // ── PIX / Prices ──────────────────────────────────────────────────────────
  const savePixKey = () => {
    if (!pixKey.trim()) return
    setSystemSettings(prev => ({ ...prev, currentPixKey: pixKey }))
    alert('Chave PIX atualizada!')
  }

  const savePrices = () => {
    const pM = parseFloat(priceMonthly)
    const pA = parseFloat(priceAnnual)
    if (isNaN(pM) || isNaN(pA)) return alert('Preços inválidos.')
    setSystemSettings(prev => {
      const oldPrices = isPromo && !prev.isPromo
        ? { monthly: prev.planPrices?.monthly, annual: prev.planPrices?.annual }
        : (!isPromo ? { monthly: null, annual: null } : prev.oldPrices)
      return { ...prev, planPrices: { monthly: pM, annual: pA }, isPromo, oldPrices }
    })
    alert('Tabela de preços publicada!')
  }

  // ── Create User ───────────────────────────────────────────────────────────
  const handleCreate = () => {
    const nome = newUser.name.trim()
    if (!nome) return alert('Informe o nome do usuário.')
    const dupName = Object.values(usersDB).some(u => u.name?.toLowerCase() === nome.toLowerCase())
    if (dupName) return alert('Nome já existe no banco. Diferencie com um sobrenome.')
    let mat = newUser.id.trim().toUpperCase()
    let pwd = newUser.password.trim()
    
    // Se não informou ID completo, gera usando o prefixo escolhido
    if (!mat) {
      mat = generateMatricula(usersDB, newUser.prefix)
    } else {
      // Se informou manual, validar se tem o formato X-YYYY (com hífen opcional ou forçado?)
      // O usuário pediu 5 dígitos + hífen. Total 6 chars.
      if (mat.length < 5) return alert('A matrícula deve ter no mínimo 5 caracteres (Ex: A-1B2C).')
    }

    if (pwd && pwd.length !== 4) return alert('A senha deve ter exatamente 4 dígitos.')
    if (usersDB[mat]) return alert('Matrícula já existe.')
    if (!pwd) pwd = generatePwd()

    setUsersDB(prev => ({
      ...prev,
      [mat]: {
        id: mat, name: nome, password: pwd,
        status: 'active', plan: 'mensal',
        isFav: false, createdAt: Date.now(), paidAt: Date.now(),
        email: '', phone: '', cpf: '',
        appData: {
          habitsBuffer: [], transactionsBuffer: [], investmentsBuffer: [],
          depositsBuffer: [], booksBuffer: [], studiesBuffer: [], runningBuffer: [],
          profile: { customFields: [], isFavorite: false },
          financeMeta: { goalAmount: 0 },
          subscription: { status: 'active', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 24 * 3600000).toISOString() }
        }
      }
    }))
    alert(`Usuário criado!\nMatrícula: ${mat}\nSenha: ${pwd}`)
    setNewUser({ name: '', id: '', password: '', prefix: 'A' })
  }

  // ── Video Boarding ────────────────────────────────────────────────────────
  const handleUploadVideo = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 30 * 1024 * 1024) return alert('Arquivo muito grande (máx 30MB).')

    const videoId = `vid_${Date.now()}`
    const existing = systemSettings.onboardingVideos || []
    
    try {
      await saveVideoBlob(videoId, file)
      
      let newList = [...existing, { id: videoId, name: file.name, date: Date.now() }]
      
      // Se tiver mais de 2, apaga o mais antigo (do DB e da lista)
      if (newList.length > 2) {
        const oldest = newList[0]
        await deleteVideoBlob(oldest.id)
        newList = newList.slice(1)
      }

      setSystemSettings(prev => ({
        ...prev,
        onboardingVideos: newList,
        activeVideoId: videoId // Ativa o novo automaticamente
      }))
      alert('Vídeo de tutorial enviado com sucesso!')
    } catch(err) {
      alert('Erro ao salvar vídeo no banco local.')
    }
  }

  const activateVideo = (id) => {
    setSystemSettings(prev => ({ ...prev, activeVideoId: id }))
  }

  const deleteVideo = async (id) => {
    if (!confirm('Excluir este vídeo permanentemente?')) return
    try {
      await deleteVideoBlob(id)
      setSystemSettings(prev => ({
        ...prev,
        onboardingVideos: (prev.onboardingVideos || []).filter(v => v.id !== id),
        activeVideoId: prev.activeVideoId === id ? null : prev.activeVideoId
      }))
    } catch(e) { alert('Erro ao excluir.') }
  }

  // ── Status & Actions ──────────────────────────────────────────────────────
  const setStatus = (id, newStatus) => {
    if (!confirm(`Alterar status de ${id} para [${newStatus.toUpperCase()}]?`)) return
    setUsersDB(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        status: newStatus,
        ...(newStatus === 'trial' ? { createdAt: Date.now() } : {})
      }
    }))
  }

  const toggleFav = (id) => {
    const willBeVip = !usersDB[id].isFav
    if (willBeVip && !confirm(`Conceder VIP Vitalício ao cliente ${id}? Ele nunca será bloqueado.`)) return
    setUsersDB(prev => ({ ...prev, [id]: { ...prev[id], isFav: !prev[id].isFav } }))
  }

  const removeUser = (id) => {
    if (!confirm(`APAGAR COMPLETAMENTE o cliente ${id}? Dados irrecuperáveis.`)) return
    setUsersDB(prev => { const u = { ...prev }; delete u[id]; return u })
  }

  const clearAllUsers = () => {
    if (window.confirm('⚠️ ATENÇÃO: Isso irá apagar TODOS os usuários permanentemente do sistema (Banco de Dados Mater). Deseja continuar?')) {
      setUsersDB({})
      alert('Base de dados zerada com sucesso.')
    }
  }

  const resetPin = (id) => {
    const newP = generatePwd()
    setUsersDB(prev => ({ ...prev, [id]: { ...prev[id], password: newP } }))
    alert(`Novo PIN para ${id}: ${newP}`)
  }

  const ghostLogin = (id) => {
    if (!confirm(`Entrar no hub de ${id} como Admin?`)) return
    login(id)
    navigate('/')
  }

  const viewReceipt = (receipt) => {
    if (!receipt) return
    const win = window.open('')
    win.document.write(`<title>Comprovante PIX</title><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#000;"><img src="${receipt}" style="max-width:100%;max-height:100vh;"/></body>`)
  }

  const addToHistory = (id, action, daysRequested) => {
    const entry = {
      id: `LOG_${Date.now()}`,
      userId: id,
      action, // 'approved' | 'rejected'
      days: daysRequested,
      date: Date.now()
    }
    const newHistory = [entry, ...approvalHistory].slice(0, 50) // keeper up to 50
    setApprovalHistory(newHistory)
    setSystemSettings(prev => ({ ...prev, approvalHistory: newHistory }))
  }

  const rejectPix = (id) => {
    const user = usersDB[id]
    const daysRequested = user?.timeRequest?.days || 30
    setUsersDB(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        status: 'active',
        timeRequest: null
      }
    }))
    addToHistory(id, 'rejected', daysRequested)
    setActionPopup({ type: 'danger', title: 'Solicitação Reprovada', msg: `O pedido de +${daysRequested} dias para ${id} foi negado. Nenhum saldo foi alterado.` })
  }

  const approvePix = (id) => {
    const user = usersDB[id]
    const daysRequested = user?.timeRequest?.days || 30
    const now = Date.now()
    
    // Calculate current expiration
    let currentExpiry = 0
    if (user?.appData?.subscription?.expiresAt) {
      currentExpiry = new Date(user.appData.subscription.expiresAt).getTime()
    }

    // If current expiry is in the future, add to it. Otherwise, start from now.
    const baseTime = currentExpiry > now ? currentExpiry : now
    const newExpiry = new Date(baseTime + (daysRequested * 24 * 3600000))

    setUsersDB(prev => {
      const u = prev[id]
      const oldTotalHours = u?.appData?.subscription?.totalHoursBought || 0
      const newTotalHours = oldTotalHours + (daysRequested * 24)

      return {
        ...prev,
        [id]: {
          ...prev[id],
          status: 'active',
          paidAt: now,
          timeRequest: null, // Clear request
          appData: {
            ...prev[id].appData,
            subscription: {
              ...(prev[id].appData?.subscription || {}),
              status: 'active',
              expiresAt: newExpiry.toISOString(),
              totalHoursBought: newTotalHours
            }
          }
        }
      }
    })
    
    addToHistory(id, 'approved', daysRequested)
    setActionPopup({ type: 'success', title: 'Registro Contabilizado!', msg: `Dias estendidos aplicados com sucesso para ${id}.` })
  }

  // ── Modal (Prontuário) ────────────────────────────────────────────────────
  const openModal = (id) => {
    const u = usersDB[id]
    setEditData({
      name: u.name || '', email: u.email || '', phone: u.phone || '',
      cpf: u.cpf || '', password: u.password || '', isFav: !!u.isFav,
      bloodType: u.appData?.profile?.bloodType || '',
      birthDate: u.appData?.profile?.birthDate || ''
    })
    setModalUser(id)
  }

  const saveModal = () => {
    setUsersDB(prev => ({
      ...prev,
      [modalUser]: {
        ...prev[modalUser],
        name: editData.name, email: editData.email, phone: editData.phone,
        cpf: editData.cpf, password: editData.password, isFav: editData.isFav,
        appData: {
          ...prev[modalUser].appData,
          profile: {
            ...(prev[modalUser].appData?.profile || {}),
            bloodType: editData.bloodType,
            birthDate: editData.birthDate,
            isFavorite: editData.isFav
          }
        }
      }
    }))
    alert('Prontuário salvo!')
    setModalUser(null)
  }

  // ── Seeder ────────────────────────────────────────────────────────────────
  const seedData = () => {
    if (!confirm('Gerar 20 clientes fictícios para teste?')) return
    const firstNames = ['Carlos', 'João', 'Marcos', 'Elias', 'Pedro', 'Maria', 'Juliana', 'Camila', 'Beatriz', 'Lucas', 'Felipe', 'Thiago', 'Gustavo', 'Letícia', 'Isabella', 'Ricardo', 'Renata', 'Patrícia', 'Amanda', 'Bruna']
    const lastNames = ['Costa', 'Silva', 'Souza', 'Oliveira', 'Lima', 'Ferreira', 'Pereira', 'Nascimento', 'Gomes', 'Martins']
    const statuses = ['active', 'blocked', 'trial', 'pending']
    const plans = ['anual', 'mensal']
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const newDB = { ...usersDB }
    for (let i = 0; i < 20; i++) {
      const pref = chars.charAt(Math.floor(Math.random() * 26)) // Letra aleatória
      const mat = generateMatricula(newDB, pref)
      const nm = firstNames[i % firstNames.length] + ' ' + lastNames[Math.floor(Math.random() * lastNames.length)]
      newDB[mat] = {
        id: mat, name: nm,
        email: nm.split(' ')[0].toLowerCase() + '@email.com',
        phone: '119' + Math.floor(10000000 + Math.random() * 90000000),
        cpf: '123456789' + Math.floor(10 + Math.random() * 89),
        password: '0000',
        plan: plans[Math.floor(Math.random() * 2)],
        status: statuses[Math.floor(Math.random() * 4)],
        isFav: Math.random() > 0.8,
        createdAt: Date.now() - Math.floor(Math.random() * 10000000000),
        appData: { habitsBuffer: [], booksBuffer: [], studiesBuffer: [], profile: { customFields: [] } }
      }
    }
    setUsersDB(newDB)
    alert('20 clientes fictícios gerados!')
  }

  // ── Filtered & sorted list ────────────────────────────────────────────────
  const userList = Object.values(usersDB)
    .filter(u =>
      (u.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => (STATUS_WEIGHT[a.status] ?? 9) - (STATUS_WEIGHT[b.status] ?? 9))

  // ── Status badge ──────────────────────────────────────────────────────────
  const statusBadge = (user) => {
    if (user.isFav) return <span style={badge('#ff9500', '#fff')}>⭐ VIP</span>
    if (user.status === 'pending') return <span style={badge('#007aff', '#fff')}>PIX Pendente</span>
    if (user.status === 'trial') return <span style={badge('#ff9500', '#fff')}>Trial</span>
    if (user.status === 'active') return <span style={badge('#30d158', '#fff')}>Ativa</span>
    if (user.status === 'blocked') return <span style={badge('#ff3b30', '#fff')}>Bloqueado</span>
    return null
  }
  const badge = (bg, color) => ({ background: bg, color, padding: '2px 8px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700 })

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout title="Painel CEO / Master" subtitle="Gestão soberana de usuários, tesouraria e acessos VIP.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── TOPO: 4 BLOCOS IGUAIS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          
          {/* 1. PIX */}
          <div className="card" style={{ borderLeft: '4px solid #007aff', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <DollarSign color="#007aff" size={18} />
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Chave PIX</h3>
            </div>
            <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '1rem', flex: 1 }}>
              Chave para depósitos rápidos.
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', flexDirection: 'column' }}>
              <input className="form-control" value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="e-mail, CPF..." style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
              <button className="btn" style={{ background: '#007aff', color: '#fff', fontSize: '0.8rem', padding: '0.5rem' }} onClick={savePixKey}>Gravar</button>
            </div>
          </div>

          {/* 2. Preços */}
          <div className="card" style={{ borderLeft: '4px solid #ff3b30', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Tag color="#ff3b30" size={18} />
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Motor Preços</h3>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.7rem', color: '#ff3b30', fontWeight: 700 }}>
                <input type="checkbox" checked={isPromo} onChange={e => setIsPromo(e.target.checked)} /> Promo
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flex: 1 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.65rem' }}>Mensal</label>
                <input className="form-control" type="number" value={priceMonthly} onChange={e => setPriceMonthly(e.target.value)} style={{ fontSize: '0.8rem' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.65rem' }}>Anual</label>
                <input className="form-control" type="number" value={priceAnnual} onChange={e => setPriceAnnual(e.target.value)} style={{ fontSize: '0.8rem' }} />
              </div>
            </div>
            <button className="btn" style={{ width: '100%', background: '#1d1d1f', color: '#fff', fontSize: '0.8rem', padding: '0.5rem' }} onClick={savePrices}>Publicar Tabela</button>
          </div>

          {/* 3. Criar Matrícula */}
          <div className="card" style={{ borderLeft: '4px solid #1d1d1f', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus color="#1d1d1f" size={18} />
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Criar Matrícula</h3>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', border: 'none', color: '#ff3b30' }} onClick={seedData} title="Gerar Clientes Falsos">
                Dev
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
              <input className="form-control" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Nome Completo *" style={{ fontSize: '0.8rem' }} />
              
              <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr', gap: '0.4rem' }}>
                <div title="Primeiro dígito (Prefixo)">
                  <input className="form-control" value={newUser.prefix} maxLength={1} style={{ textTransform: 'uppercase', fontSize: '0.8rem', textAlign: 'center', fontWeight: 700 }} onChange={e => setNewUser({ ...newUser, prefix: e.target.value.toUpperCase() })} placeholder="Pr." />
                </div>
                <input className="form-control" value={newUser.id} maxLength={6} style={{ textTransform: 'uppercase', fontSize: '0.8rem' }} onChange={e => setNewUser({ ...newUser, id: e.target.value })} placeholder="ID Manual" />
                <input className="form-control" value={newUser.password} maxLength={4} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="PIN" style={{ fontSize: '0.8rem' }} />
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto' }}>
                <button className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }} onClick={() => setNewUser({ ...newUser, id: generateMatricula(usersDB, newUser.prefix), password: generatePwd() })}>Gerar ID</button>
                <button className="btn" style={{ flex: 2, background: '#1d1d1f', color: '#fff', padding: '0.5rem', fontSize: '0.75rem' }} onClick={handleCreate}>Cadastrar Cliente</button>
              </div>
            </div>
          </div>

          {/* 4. Itens Pendentes (Aprovações Concentradas aqui) */}
          <div className="card" style={{ borderLeft: '4px solid #ff9500', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Clock color="#ff9500" size={18} />
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Itens Pendentes</h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '180px', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '4px' }}>
              {userList.filter(u => u.status === 'pending').length === 0 ? (
                <div className="text-muted" style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '1.5rem', fontWeight: 500 }}>Limpo! Operações em dia.</div>
              ) : (
                userList.filter(u => u.status === 'pending').map(u => (
                  <div key={u.id} style={{ background: '#f5f5f7', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e5e5ea', transition: 'transform 0.1s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.75rem', color: '#1d1d1f' }}>{u.id} - {u.name || 'S/Nome'}</span>
                      {u.timeRequest?.receipt && (
                         <button className="btn btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.6rem', color: '#007aff', background: 'transparent', border: '1px solid #007aff' }} onClick={() => viewReceipt(u.timeRequest.receipt)}>Ticket</button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button className="btn" style={{ flex: 1, background: '#30d158', color: '#fff', padding: '0.35rem', fontSize: '0.7rem', fontWeight: 600, border: 'none' }} onClick={() => approvePix(u.id)}>Aprovar</button>
                      <button className="btn" style={{ flex: 1, background: 'rgba(255,59,48,0.1)', color: '#ff3b30', border: 'none', padding: '0.35rem', fontSize: '0.7rem', fontWeight: 600 }} onClick={() => rejectPix(u.id)}>Reprovar</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* ── SEÇÃO: VÍDEO DE ONBOARDING ── */}
        <div className="card" style={{ borderLeft: '4px solid #5856d6', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: 40, height: 40, background: 'rgba(88,86,214,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Video color="#5856d6" size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Manual do Usuário (Vídeo de Início)</h3>
                <p className="text-muted" style={{ fontSize: '0.75rem', margin: 0 }}>Aparece ao abrir o app (Pop-up de instalação PWA).</p>
              </div>
            </div>
            <label className="btn" style={{ background: '#5856d6', color: '#fff', padding: '0.6rem 1.2rem', fontSize: '0.8rem', cursor: 'pointer', gap: '8px', borderRadius: '12px' }}>
              <Plus size={16} /> Carregar Novo Vídeo
              <input type="file" hidden accept="video/*" onChange={handleUploadVideo} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {(systemSettings.onboardingVideos || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', background: '#f5f5f7', borderRadius: '16px', fontSize: '0.85rem', color: '#86868b', border: '1px dashed #d2d2d7', gridColumn: '1 / -1' }}>
                Nenhum vídeo carregado. Faça o primeiro upload para ativar o on-boarding.
              </div>
            ) : (
              (systemSettings.onboardingVideos || []).map(vid => (
                <div key={vid.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '1rem', borderRadius: '16px', background: systemSettings.activeVideoId === vid.id ? 'rgba(88,86,214,0.05)' : '#fff',
                  border: systemSettings.activeVideoId === vid.id ? '2px solid #5856d6' : '1px solid #e5e5ea',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{ width: 32, height: 32, background: systemSettings.activeVideoId === vid.id ? '#5856d6' : '#86868b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      {systemSettings.activeVideoId === vid.id ? <Check size={16} /> : <Play size={16} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1d1d1f' }}>{vid.name.length > 20 ? vid.name.slice(0, 18) + '...' : vid.name}</div>
                      <div style={{ fontSize: '0.65rem', color: '#86868b' }}>{new Date(vid.date).toLocaleDateString()} às {new Date(vid.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {systemSettings.activeVideoId !== vid.id && (
                      <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem', borderRadius: '8px' }} onClick={() => activateVideo(vid.id)}>Ativar</button>
                    )}
                    <button className="btn btn-secondary" style={{ padding: '0.4rem', fontSize: '0.7rem', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.2)', borderRadius: '8px' }} onClick={() => deleteVideo(vid.id)} title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── CEO INBOX REMOVIDO A PEDIDO DO USUÁRIO ── */}

        {/* ── LISTA DE USUÁRIOS ── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={20} color="#86868b" />
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Base de Usuários ({userList.length})</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
               <div style={{ position: 'relative', minWidth: '220px' }}>
                  <input className="form-control" placeholder="Buscar matrícula, nome, e-mail..." style={{ paddingLeft: '2rem', fontSize: '0.85rem' }}
                     value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  <Search size={14} style={{ position: 'absolute', left: '8px', top: '11px', color: '#86868b' }} />
               </div>
               <button className="btn btn-secondary" style={{ color: '#ff3b30', border: '1px solid #ff3b30', fontSize: '0.75rem', fontWeight: 600 }} onClick={clearAllUsers}>
                  Zerar Base
               </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '600px', overflowY: 'auto' }}>
            {userList.length === 0 && <div className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>Nenhum usuário encontrado.</div>}
            {userList.map(u => {
              const exp = getExpirationInfo(u)
              return (
                <div key={u.id} 
                  onClick={() => openModal(u.id)}
                  style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                  background: u.isFav ? 'rgba(255,215,0,0.04)' : u.status === 'pending' ? 'rgba(0,122,255,0.03)' : 'var(--bg-color)',
                  padding: '0.8rem 1rem', borderRadius: '10px',
                  borderLeft: u.status === 'pending' ? '4px solid #007aff' : u.isFav ? '4px solid #ff9500' : '4px solid transparent',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}>
                  {/* Info Primária */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1 }}>
                    <div style={{ fontWeight: 700, background: '#1d1d1f', color: '#fff', padding: '3px 8px', borderRadius: '6px', letterSpacing: '1px', fontSize: '0.85rem' }}>{u.id}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1d1d1f' }}>{u.name || 'Sem nome'}</div>
                  </div>
                  
                  {/* Prazo Restante / Vencimento */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: '130px' }}>
                    <Clock size={12} color={exp.color} />
                    <span style={{ fontSize: '0.75rem', color: exp.color, fontWeight: 600 }}>{exp.label}</span>
                  </div>

                  {/* Situação de Pagamento / Pendências */}
                  <div style={{ width: '130px', textAlign: 'right' }}>
                    {u.status === 'pending' ? (
                      <span style={{ color: '#007aff', fontWeight: 800, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}><div style={{width: 6, height: 6, borderRadius: '50%', background: '#007aff'}}></div> Pendente</span>
                    ) : u.status === 'blocked' ? (
                       <span style={{ color: '#ff3b30', fontWeight: 800, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}><Lock size={10} color="#ff3b30"/> Bloqueado</span>
                    ) : (
                      <span style={{ color: '#86868b', fontWeight: 600, fontSize: '0.72rem' }}>Resolvido</span>
                    )}
                  </div>

                </div>
              )
            })}
          </div>
        </div>

        {/* ── MIGRATION & BACKUP ── */}
        <div className="card" style={{ borderLeft: '4px solid #ff9500', marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.2rem' }}>
            <RefreshCw color="#ff9500" size={20} />
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Sincronização & Migração (de hub-app)</h3>
          </div>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
            Como os dados são locais ao navegador, para migrar do app antigo para este React:
            <br />1. Abra o <b>app antigo</b> → F12 → Consola.
            <br />2. Cole: <code>copy(localStorage.getItem('hub_books_db'))</code> para copiar o acervo de livros.
            <br />3. Cole o resultado abaixo e clique em Importar.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            {/* Users Import */}
            <div style={{ background: '#f5f5f7', padding: '1rem', borderRadius: '12px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>1. Usuários (hub_users_db)</label>
              <textarea 
                className="form-control" 
                rows={3} 
                placeholder="Cole o JSON de usuários..." 
                id="import-users-json"
                style={{ fontSize: '0.7rem', fontFamily: 'monospace', marginBottom: '0.5rem' }}
              />
              <button 
                className="btn" 
                style={{ width: '100%', background: '#1d1d1f', color: '#fff', fontSize: '0.75rem' }}
                onClick={() => {
                  try {
                    const json = document.getElementById('import-users-json').value.trim()
                    if(!json) return
                    const data = JSON.parse(json)
                    setUsersDB(prev => ({ ...prev, ...data }))
                    alert('Usuários importados com sucesso!')
                    document.getElementById('import-users-json').value = ''
                  } catch(e) { alert('Erro: JSON inválido.') }
                }}
              >
                Importar Usuários
              </button>
            </div>

            {/* Books Import */}
            <div style={{ background: '#f5f5f7', padding: '1rem', borderRadius: '12px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>2. Livros (hub_books_db)</label>
              <textarea 
                className="form-control" 
                rows={3} 
                placeholder="Cole o JSON de livros..." 
                id="import-books-json"
                style={{ fontSize: '0.7rem', fontFamily: 'monospace', marginBottom: '0.5rem' }}
              />
              <button 
                className="btn" 
                style={{ width: '100%', background: '#007aff', color: '#fff', fontSize: '0.75rem' }}
                onClick={() => {
                  try {
                    const json = document.getElementById('import-books-json').value.trim()
                    if(!json) return
                    const data = JSON.parse(json)
                    const old = JSON.parse(localStorage.getItem('hub_books_db') || '{}')
                    localStorage.setItem('hub_books_db', JSON.stringify({ ...old, ...data }))
                    alert('Acervo de livros importado!')
                    window.location.reload()
                  } catch(e) { alert('Erro: JSON inválido.') }
                }}
              >
                Importar Acervo de Livros
              </button>
            </div>

            {/* Studies Import */}
            <div style={{ background: '#f5f5f7', padding: '1rem', borderRadius: '12px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>3. Estudos (hub_studies_db)</label>
              <textarea 
                className="form-control" 
                rows={3} 
                placeholder="Cole o JSON de estudos..." 
                id="import-studies-json"
                style={{ fontSize: '0.7rem', fontFamily: 'monospace', marginBottom: '0.5rem' }}
              />
              <button 
                className="btn" 
                style={{ width: '100%', background: '#30d158', color: '#fff', fontSize: '0.75rem' }}
                onClick={() => {
                  try {
                    const json = document.getElementById('import-studies-json').value.trim()
                    if(!json) return
                    const data = JSON.parse(json)
                    const old = JSON.parse(localStorage.getItem('hub_studies_db') || '{}')
                    localStorage.setItem('hub_studies_db', JSON.stringify({ ...old, ...data }))
                    alert('Acervo de estudos importado!')
                    window.location.reload()
                  } catch(e) { alert('Erro: JSON inválido.') }
                }}
              >
                Importar Acervo de Estudos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL PRONTUÁRIO ── */}
      {modalUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', borderRadius: '16px' }}>
            <button onClick={() => setModalUser(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>Prontuário do Cliente</h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Matrícula: <strong style={{ color: '#007aff' }}>{modalUser}</strong>
            </p>

            {/* Timer */}
            <div style={{ background: 'rgba(255,59,48,0.08)', borderLeft: '4px solid #ff3b30', padding: '0.8rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#ff3b30', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Status do Bloqueio</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 500 }}>
                <Clock size={14} /> {getExpirationInfo(usersDB[modalUser]).label}
              </div>
            </div>

            {/* VIP */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', background: 'rgba(255,215,0,0.06)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(255,215,0,0.3)' }}>
              <input type="checkbox" checked={editData.isFav} onChange={e => setEditData({ ...editData, isFav: e.target.checked })} style={{ width: 18, height: 18 }} />
              <div>
                <strong>Tornar VIP / Favorito</strong>
                <p style={{ fontSize: '0.75rem', color: '#86868b', margin: 0 }}>Acesso vitalício — burla a catraca de pagamento.</p>
              </div>
            </label>

            {/* Grid de campos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
              {[['Nome Completo', 'name', 'text'], ['Telefone', 'phone', 'tel'], ['E-mail', 'email', 'email'], ['CPF', 'cpf', 'text']].map(([label, key, type]) => (
                <div key={key} style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', padding: '0.6rem 1rem', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.68rem', color: '#86868b', fontWeight: 600, display: 'block', marginBottom: '0.2rem', textTransform: 'uppercase' }}>{label}</span>
                  <input type={type} value={editData[key] || ''} onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                    style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.92rem', fontWeight: 500 }} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.7rem', color: '#86868b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '0.6rem' }}>Métricas Biométricas</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                {[['Tipo Sanguíneo', 'bloodType', 'text', 'Ex: O+'], ['Data Nasc.', 'birthDate', 'date', '']].map(([label, key, type, ph]) => (
                  <div key={key} style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', padding: '0.6rem 1rem', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#86868b', fontWeight: 600, display: 'block', marginBottom: '0.2rem', textTransform: 'uppercase' }}>{label}</span>
                    <input type={type} placeholder={ph} value={editData[key] || ''} onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                      style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '0.92rem', fontWeight: 500 }} />
                  </div>
                ))}
              </div>
            </div>

            {/* PIN */}
            <div style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', padding: '0.6rem 1rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.68rem', color: '#86868b', fontWeight: 600, display: 'block', marginBottom: '0.2rem', textTransform: 'uppercase' }}>PIN / Senha de Acesso</span>
              <input value={editData.password || ''} onChange={e => setEditData({ ...editData, password: e.target.value })}
                style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: '0.2rem', fontWeight: 600 }} />
            </div>

            {/* Administração Restrita */}
            <h4 style={{ fontSize: '0.85rem', color: '#1d1d1f', borderBottom: '1px solid #e5e5ea', paddingBottom: '0.5rem', marginBottom: '1rem', marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} color="#ff3b30" /> Controles Restritos
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.8rem' }}>
               <button 
                  className="btn" 
                  style={{ 
                     background: usersDB[modalUser].status === 'blocked' ? '#30d158' : 'rgba(255,59,48,0.1)', 
                     color: usersDB[modalUser].status === 'blocked' ? '#fff' : '#ff3b30', 
                     fontSize: '0.75rem', padding: '0.6rem', border: usersDB[modalUser].status === 'blocked' ? 'none' : '1px solid rgba(255,59,48,0.3)'
                  }} 
                  onClick={() => setStatus(modalUser, usersDB[modalUser].status === 'blocked' ? 'trial' : 'blocked')}
               >
                  {usersDB[modalUser].status === 'blocked' ? '🔓 Desbloquear Cliente' : '🔒 Bloquear Acesso'}
               </button>
               <button 
                  className="btn btn-secondary" 
                  style={{ color: '#ff3b30', fontSize: '0.75rem', background: 'transparent', border: '1px dashed rgba(255,59,48,0.5)' }} 
                  onClick={() => {
                     removeUser(modalUser);
                     setModalUser(null);
                  }}
               >
                  <Trash2 size={14} style={{ marginRight: '6px' }} /> Excluir Cliente
               </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setModalUser(null)}>Voltar</button>
              <button className="btn" style={{ flex: 2, background: '#1d1d1f', color: '#fff' }} onClick={saveModal}>Salvar Dossiê</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL REMOVIDO A PEDIDO DO USUÁRIO ── */}

      {/* ── ACTION POPUP (REGISTRO CONTABILIZADO / REPROVADO) ── */}
      {actionPopup && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 99999, background: '#fff', padding: '1.2rem', borderRadius: '12px', border: `1px solid ${actionPopup.type === 'success' ? '#30d158' : '#ff3b30'}`, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', width: '300px', transform: 'translateY(0)', animation: 'slideUp 0.3s ease' }}>
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: actionPopup.type === 'success' ? '#30d158' : '#ff3b30', fontWeight: 800 }}>
                {actionPopup.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                {actionPopup.title}
              </div>
              <button onClick={() => setActionPopup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86868b' }}>
                <X size={16} />
              </button>
           </div>
           <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {actionPopup.msg}
           </div>
           
           <button className="btn" style={{ width: '100%', marginTop: '1rem', background: '#1d1d1f', color: '#fff', padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => setActionPopup(null)}>
             Fechar
           </button>
        </div>
      )}
    </Layout>
  )
}
