import React, { useState, useMemo, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { useAppContext } from '../context/AppContext'
import { Plus, Trash2, Calendar, TrendingUp, DollarSign, Target } from 'lucide-react'
import { Chart, registerables } from 'chart.js'
import { subDays, subMonths, subYears, format as fnsFormat, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns'
Chart.register(...registerables)

const today = () => new Date().toISOString().split('T')[0]
const fmtDate = (d) => { const p = d.split('-'); return `${p[2]}/${p[1]}` }
const fmtMonth = (m) => { const p = m.split('-'); return `${p[1]}/${p[0]}` }

// ─── Chart Canvas wrapper ────────────────────────────────────────────────────
function CanvasChart({ id, buildChart }) {
  const ref = useRef(null)
  const inst = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    if (inst.current) inst.current.destroy()
    inst.current = buildChart(ref.current)
    return () => { if (inst.current) inst.current.destroy() }
  })
  return <canvas ref={ref} id={id} style={{ width: '100%', height: '100%' }} />
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Finance() {
  const { appData, updateAppData, updateProfile, usersDB, currentUser, setUsersDB } = useAppContext()
  const [tab, setTab] = useState('cashflow')

  // Cashflow state
  const [cfFilter, setCfFilter] = useState('all')
  const [showCfTray, setShowCfTray] = useState(false)
  const [cfCustom, setCfCustom] = useState({ month: '', start: '', end: '' })
  const [newT, setNewT] = useState({ description: '', amount: '', type: 'income', date: today() })
  const [goalInput, setGoalInput] = useState('')

  // Investments state
  const [invFilter, setInvFilter] = useState('all')
  const [showInvTray, setShowInvTray] = useState(false)
  const [invCustom, setInvCustom] = useState({ month: '', start: '', end: '' })
  const [newDeposit, setNewDeposit] = useState({ date: today(), amount: '' })
  const [newInv, setNewInv] = useState({ month: '', total: '' })

  if (!appData) return <div style={{ padding: '2rem', textAlign: 'center', color: '#86868b' }}>Carregando...</div>

  const transactions = appData.transactionsBuffer || []
  const investments = appData.investmentsBuffer || []
  const deposits = appData.depositsBuffer || []
  const financeMeta = appData.financeMeta || { goalAmount: 0 }

  // ── Cashflow Actions ──────────────────────────────────────────────────────
  const addTransaction = () => {
    if (!newT.description.trim() || !newT.amount || !newT.date) return alert('Preencha todos os campos.')
    const t = { id: 'T_' + Date.now(), description: newT.description.trim(), amount: parseFloat(newT.amount), type: newT.type, date: newT.date }
    updateAppData(prev => ({
      ...prev,
      transactionsBuffer: [...(prev.transactionsBuffer || []), t].sort((a, b) => new Date(b.date) - new Date(a.date))
    }))
    setNewT({ ...newT, description: '', amount: '' })
  }

  const removeTransaction = (id) => {
    if (!confirm('Remover lançamento?')) return
    updateAppData(prev => ({ ...prev, transactionsBuffer: prev.transactionsBuffer.filter(t => t.id !== id) }))
  }

  const saveGoal = () => {
    const val = parseFloat(goalInput) || 0
    updateAppData(prev => ({ ...prev, financeMeta: { ...prev.financeMeta, goalAmount: val } }))
  }

  // ── Investment Actions ─────────────────────────────────────────────────────
  const addDeposit = () => {
    if (!newDeposit.date || !newDeposit.amount || parseFloat(newDeposit.amount) <= 0) return alert('Informe data e valor do aporte.')
    const dep = { id: 'D_' + Date.now(), date: newDeposit.date, amount: parseFloat(newDeposit.amount) }
    updateAppData(prev => ({
      ...prev,
      depositsBuffer: [...(prev.depositsBuffer || []), dep].sort((a, b) => new Date(b.date) - new Date(a.date))
    }))
    setNewDeposit({ ...newDeposit, amount: '' })
  }

  const removeDeposit = (id) => {
    if (!confirm('Remover aporte?')) return
    updateAppData(prev => ({ ...prev, depositsBuffer: prev.depositsBuffer.filter(d => d.id !== id) }))
  }

  const addInvestmentRecord = () => {
    if (!newInv.month || !newInv.total || isNaN(parseFloat(newInv.total))) return alert('Preencha mês e saldo.')
    const record = { id: 'I_' + Date.now(), month: newInv.month, realValue: parseFloat(newInv.total) }
    updateAppData(prev => ({
      ...prev,
      investmentsBuffer: [...(prev.investmentsBuffer || []).filter(i => i.month !== newInv.month), record]
        .sort((a, b) => a.month.localeCompare(b.month))
    }))
    setNewInv({ month: '', total: '' })
  }

  const removeInvestment = (id) => {
    if (!confirm('Remover fechamento?')) return
    updateAppData(prev => ({ ...prev, investmentsBuffer: prev.investmentsBuffer.filter(i => i.id !== id) }))
  }

  // ── Cashflow KPIs ─────────────────────────────────────────────────────────
  let totalIn = 0, totalOut = 0
  transactions.forEach(t => { if (t.type === 'income') totalIn += t.amount; else totalOut += t.amount })
  const balance = totalIn - totalOut
  const goalPct = financeMeta.goalAmount > 0 ? Math.min((balance / financeMeta.goalAmount) * 100, 100) : 0

  // ── Cashflow Chart Data ───────────────────────────────────────────────────
  const cfChartData = useMemo(() => {
    const now = new Date()
    let startDate = null
    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date))
    let running = 0

    if (cfFilter === '7') startDate = subDays(now, 6)
    else if (cfFilter === '30') startDate = subDays(now, 29)
    else if (cfFilter === '365') startDate = subYears(now, 1)
    else if (typeof cfFilter === 'object' && cfFilter?.type === 'range') {
      startDate = parseISO(cfFilter.start)
    }

    const grouped = {}
    sorted.forEach(t => {
      if (!grouped[t.date]) grouped[t.date] = 0
      grouped[t.date] += (t.type === 'income' ? t.amount : -t.amount)
    })

    const labels = [], values = []
    for (const d in grouped) {
      running += grouped[d]
      let valid = true
      if (startDate && new Date(d) < startOfDay(startDate)) valid = false
      if (typeof cfFilter === 'object' && cfFilter?.type === 'range' && new Date(d) > endOfDay(parseISO(cfFilter.end))) valid = false
      
      if (valid) {
        labels.push(fmtDate(d))
        values.push(running)
      }
    }
    if (!labels.length && sorted.length) { labels.push('Hoje'); values.push(running) }
    return { labels, values }
  }, [transactions, cfFilter])

  // ── Investment KPIs ───────────────────────────────────────────────────────
  const totalDeposited = deposits.reduce((s, d) => s + d.amount, 0)
  const lastInv = investments.length ? investments[investments.length - 1] : null
  const invKPIs = lastInv ? {
    patrimony: lastInv.realValue,
    deposited: totalDeposited,
    profit: lastInv.realValue - totalDeposited
  } : null

  // ── Investment Chart (Curva S) ────────────────────────────────────────────
  const invChartData = useMemo(() => {
    const labels = [], dataReal = [], dataProj = [], dataAportes = []
    let avgRent = 0.01, avgDeposit = 0

    if (investments.length > 0) {
      let rSum = 0, validMonths = 0
      for (let x = 0; x < investments.length; x++) {
        const aportesDoMes = deposits.filter(d => d.date.startsWith(investments[x].month)).reduce((s, d) => s + d.amount, 0)
        if (x > 0) {
          const prior = investments[x - 1].realValue
          if (prior > 0) { rSum += (investments[x].realValue - aportesDoMes - prior) / prior; validMonths++ }
        }
      }
      if (validMonths > 0) avgRent = rSum / validMonths
      avgDeposit = totalDeposited / investments.length
    }

    investments.forEach((inv, idx) => {
      const accDep = deposits.filter(d => d.date <= inv.month + '-31').reduce((s, d) => s + d.amount, 0)
      labels.push(fmtMonth(inv.month))
      dataReal.push(inv.realValue)
      dataAportes.push(accDep)
      dataProj.push(null)
    })

    if (investments.length > 0) {
      let simValue = investments[investments.length - 1].realValue
      const simDate = new Date(investments[investments.length - 1].month + '-01')
      dataProj[dataProj.length - 1] = simValue

      for (let m = 1; m <= 12; m++) {
        simDate.setMonth(simDate.getMonth() + 1)
        const labelStr = String(simDate.getMonth() + 1).padStart(2, '0') + '/' + simDate.getFullYear()
        simValue = simValue * (1 + Math.max(avgRent, 0.01)) + avgDeposit
        labels.push(labelStr)
        dataReal.push(null)
        dataProj.push(simValue)
        dataAportes.push((dataAportes[dataAportes.length - 1] || 0) + avgDeposit)
      }
    }

    // Apply filter
    let fl = labels, fr = dataReal, fp = dataProj, fa = dataAportes
    if (invFilter === '6') {
      const cutoff = subMonths(new Date(), 5)
      const startStr = fnsFormat(cutoff, 'yyyy-MM')
      const idx = labels.findIndex(l => {
        const [m, y] = l.split('/')
        return y + '-' + m >= startStr
      })
      if (idx !== -1) {
        fl = labels.slice(idx); fr = dataReal.slice(idx); fp = dataProj.slice(idx); fa = dataAportes.slice(idx)
      }
    } else if (invFilter === '12') {
       const cutoff = subMonths(new Date(), 11)
       const startStr = fnsFormat(cutoff, 'yyyy-MM')
       const idx = labels.findIndex(l => {
         const [m, y] = l.split('/')
         return y + '-' + m >= startStr
       })
       if (idx !== -1) {
         fl = labels.slice(idx); fr = dataReal.slice(idx); fp = dataProj.slice(idx); fa = dataAportes.slice(idx)
       }
    } else if (typeof invFilter === 'object' && invFilter) {
      const idxs = labels.reduce((acc, l, i) => {
        const [mm, yy] = l.split('/')
        const yyyymm = yy + '-' + mm
        if (invFilter.type === 'range' && yyyymm >= invFilter.start && yyyymm <= invFilter.end) acc.push(i)
        return acc
      }, [])
      fl = idxs.map(i => labels[i])
      fr = idxs.map(i => dataReal[i])
      fp = idxs.map(i => dataProj[i])
      fa = idxs.map(i => dataAportes[i])
    }

    return { labels: fl, dataReal: fr, dataProj: fp, dataAportes: fa }
  }, [investments, deposits, invFilter])

  // ── Rentabilidade por fechamento ───────────────────────────────────────────
  const invWithRent = investments.map((inv, idx) => {
    const aportesDoMes = deposits.filter(d => d.date.startsWith(inv.month)).reduce((s, d) => s + d.amount, 0)
    let rentMonth = 0
    const prior = idx > 0 ? investments[idx - 1].realValue : 0
    if (prior > 0) {
      rentMonth = ((inv.realValue - aportesDoMes - prior) / prior) * 100
    } else if (aportesDoMes > 0 && idx === 0) {
      rentMonth = ((inv.realValue - aportesDoMes) / aportesDoMes) * 100
    }
    return { ...inv, rentMonth, aportesDoMes }
  })

  // ─────────────────────────────────────────────────────────────────────────
  const FilterBtn = ({ val, label, active, onClick }) => (
    <button onClick={onClick} style={{
      padding: '3px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
      background: active ? '#1d1d1f' : 'transparent', color: active ? '#fff' : '#86868b'
    }}>{label}</button>
  )

  return (
    <Layout title="Métricas Financeiras" subtitle="Acompanhamento do Caixa e Evolução Patrimonial">

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[['cashflow', '💳 Fluxo de Caixa'], ['investments', '📈 Investimentos']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '0.5rem 1.2rem', border: 'none', borderRadius: '999px', cursor: 'pointer',
            background: tab === key ? '#1d1d1f' : '#f5f5f7', color: tab === key ? '#fff' : '#1d1d1f', fontWeight: 600, fontSize: '0.85rem'
          }}>{label}</button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* CASHFLOW TAB */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {tab === 'cashflow' && (
        <>
          <div className="dashboard-grid">
            {/* Form + Lista */}
            <div className="card">
              <h3 className="card-title">Novo Lançamento</h3>
              <div className="form-group">
                <input className="form-control" placeholder="Descrição (Ex: Mercado)" value={newT.description}
                  onChange={e => setNewT({ ...newT, description: e.target.value })} style={{ marginBottom: '0.5rem' }} />
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input type="number" className="form-control" placeholder="R$ 0,00" value={newT.amount}
                    onChange={e => setNewT({ ...newT, amount: e.target.value })} />
                  <select className="form-control" style={{ width: 'auto' }} value={newT.type}
                    onChange={e => setNewT({ ...newT, type: e.target.value })}>
                    <option value="income">Entrada (+)</option>
                    <option value="expense">Saída (-)</option>
                  </select>
                </div>
                <input type="date" className="form-control" value={newT.date}
                  onChange={e => setNewT({ ...newT, date: e.target.value })} style={{ marginBottom: '1rem' }} />
                <button className="btn" style={{ width: '100%', background: '#1d1d1f', color: '#fff' }} onClick={addTransaction}>
                  Registrar Lançamento
                </button>
              </div>

              {/* KPIs (Now below form and smaller) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '1.5rem', marginTop: '1rem' }}>
                {[
                  { label: 'Saldo Atual', value: `R$ ${balance.toFixed(0)}`, color: balance >= 0 ? undefined : '#ff3b30' },
                  { 
                    label: 'Sua Meta', 
                    value: `R$ ${financeMeta.goalAmount || 0}`, 
                    subvalue: `${goalPct.toFixed(1)}%`,
                    missing: balance < (financeMeta.goalAmount || 0) ? `Faltam R$ ${(financeMeta.goalAmount - balance).toFixed(0)}` : 'Meta Atingida!',
                    onClick: () => {
                      const newGoal = prompt('Qual o seu objetivo financeiro (R$)?', financeMeta.goalAmount || '');
                      if (newGoal !== null && !isNaN(parseFloat(newGoal))) {
                        updateAppData(prev => ({ ...prev, financeMeta: { ...prev.financeMeta, goalAmount: parseFloat(newGoal) } }));
                      }
                    }
                  },
                  { label: 'Entradas', value: `R$ ${totalIn.toFixed(0)}`, color: '#30d158' },
                  { label: 'Saídas', value: `R$ ${totalOut.toFixed(0)}`, color: '#ff3b30' }
                ].map(({ label, value, color, subvalue, missing, onClick }) => (
                  <div key={label} onClick={onClick} style={{ 
                    background: '#f5f5f7', 
                    borderRadius: '10px', 
                    padding: '0.6rem', 
                    textAlign: 'center',
                    cursor: onClick ? 'pointer' : 'default',
                    border: onClick ? '1px dashed rgba(0,122,255,0.3)' : 'none'
                  }}>
                    <div style={{ fontSize: '0.55rem', color: '#86868b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{label}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: color || '#1d1d1f' }}>{value}</div>
                    {subvalue && <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#007aff', marginTop: '2px' }}>{subvalue}</div>}
                    {missing && <div style={{ fontSize: '0.55rem', color: '#86868b', marginTop: '2px', fontStyle: 'italic' }}>{missing}</div>}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '2rem' }}>
                <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Histórico Recente</h4>
                <ul className="list-group" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                  {!transactions.length
                    ? <li className="list-item text-muted">Nenhuma transação.</li>
                    : transactions.map(t => (
                      <li key={t.id} className="list-item" style={{ padding: '0.6rem 0' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{t.description}</div>
                          <div className="text-muted" style={{ fontSize: '0.78rem' }}>{fmtDate(t.date)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className={t.type === 'income' ? 'green' : ''} style={{ fontWeight: 600 }}>
                            {t.type === 'income' ? '+' : '-'} R$ {t.amount.toFixed(2)}
                          </div>
                          <button className="btn btn-secondary" style={{ border: 'none', padding: '1px 4px', fontSize: '0.72rem', color: '#ff3b30' }}
                            onClick={() => removeTransaction(t.id)}><Trash2 size={11} /></button>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            </div>

            {/* Gráfico + Filtros + Meta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 className="card-title" style={{ marginBottom: 0 }}>Evolução do Saldo</h3>
                    <p className="card-desc" style={{ marginBottom: 0, fontSize: '0.8rem' }}>Histórico consolidado do caixa.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '2px', background: '#f5f5f7', padding: '3px', borderRadius: '8px', border: '1px solid #e5e5ea' }}>
                    {[['7', '7D'], ['30', '30D'], ['365', 'Ano'], ['all', 'Total']].map(([v, l]) => (
                      <button key={v} onClick={() => { setCfFilter(v); setShowCfTray(false) }} style={{
                        padding: '3px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                        background: cfFilter === v ? '#1d1d1f' : 'transparent', color: cfFilter === v ? '#fff' : '#86868b'
                      }}>{l}</button>
                    ))}
                    <button onClick={() => setShowCfTray(!showCfTray)} style={{ background: typeof cfFilter === 'object' ? '#1d1d1f' : 'transparent', color: typeof cfFilter === 'object' ? '#fff' : '#86868b', border: 'none', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>
                      Datas
                    </button>
                  </div>
                </div>

                {showCfTray && (
                  <div style={{ background: '#f5f5f7', padding: '1rem', borderRadius: '10px', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.8rem', alignItems: 'flex-end' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.7rem' }}>Mês Fechado</label>
                      <input type="month" className="form-control" style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                        value={cfCustom.month} onChange={e => setCfCustom({ ...cfCustom, month: e.target.value })} />
                    </div>
                    <span style={{ color: '#86868b', fontSize: '0.75rem', fontWeight: 700, paddingBottom: '4px' }}>OU</span>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.7rem' }}>De:</label>
                      <input type="date" className="form-control" style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                        value={cfCustom.start} onChange={e => setCfCustom({ ...cfCustom, start: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.7rem' }}>Até:</label>
                      <input type="date" className="form-control" style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                        value={cfCustom.end} onChange={e => setCfCustom({ ...cfCustom, end: e.target.value })} />
                    </div>
                    <button className="btn" style={{ background: '#1d1d1f', color: '#fff', fontSize: '0.8rem', padding: '0.4rem 1rem' }} onClick={() => {
                      if (cfCustom.month) setCfFilter({ type: 'month', val: cfCustom.month })
                      else if (cfCustom.start && cfCustom.end) setCfFilter({ type: 'range', start: cfCustom.start, end: cfCustom.end })
                      else alert('Selecione mês ou informe De e Até.')
                      setShowCfTray(false)
                    }}>Filtrar</button>
                  </div>
                )}

                <div style={{ height: '320px' }}>
                  <CanvasChart id="cfChart" buildChart={(ctx) => new Chart(ctx, {
                    type: 'line',
                    data: {
                      labels: cfChartData.labels,
                      datasets: [{ label: 'Saldo Acumulado', data: cfChartData.values, borderColor: '#1d1d1f', backgroundColor: 'rgba(29,29,31,0.05)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#fff', pointBorderColor: '#1d1d1f', borderWidth: 2 }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } } }
                  })} />
                </div>
              </div>

              {/* Meta Patrimonial */}
              <div className="card" style={{ borderLeft: '4px solid #30d158', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.2rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Target size={16} color="#30d158" />Meta Patrimonial de Caixa
                  </h4>
                  <p className="text-muted" style={{ fontSize: '0.78rem', margin: 0 }}>Estipule o teto de reserva ou saldo a alcançar.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500 }}>R$</span>
                  <input type="number" className="form-control" placeholder={financeMeta.goalAmount || '10000'}
                    style={{ width: '140px' }} value={goalInput} onChange={e => setGoalInput(e.target.value)} />
                  <button className="btn" style={{ background: '#1d1d1f', color: '#fff' }} onClick={saveGoal}>Salvar</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* INVESTMENTS TAB */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {tab === 'investments' && (
        <>
          {/* KPIs Investimento */}
          {invKPIs && (
            <div className="stats-grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="stat-card">
                <div className="stat-label">Patrimônio Realizado</div>
                <div className="stat-value">R$ {invKPIs.patrimony.toFixed(0)}</div>
              </div>
              <div className="stat-card" style={{ cursor: 'pointer', border: '1px dashed rgba(0,122,255,0.3)' }} onClick={() => {
                const newGoal = prompt('Qual sua Meta Patrimonial (R$)?', appData.financeMeta?.goalPatrimony || '');
                if (newGoal !== null && !isNaN(parseFloat(newGoal))) {
                  updateAppData(prev => ({ ...prev, financeMeta: { ...prev.financeMeta, goalPatrimony: parseFloat(newGoal) } }));
                }
              }}>
                <div className="stat-label">Meta Patrimonial</div>
                <div className="stat-value" style={{ color: 'var(--accent-color)' }}>R$ {(appData.financeMeta?.goalPatrimony || 0).toFixed(0)}</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#007aff' }}>
                  {appData.financeMeta?.goalPatrimony > 0 ? `${((invKPIs.patrimony / appData.financeMeta.goalPatrimony) * 100).toFixed(1)}%` : '0.0%'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Aportado</div>
                <div className="stat-value" style={{ color: '#86868b' }}>R$ {invKPIs.deposited.toFixed(0)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Lucro Histórico</div>
                <div className={`stat-value ${invKPIs.profit >= 0 ? 'green' : 'red'}`}>R$ {invKPIs.profit.toFixed(0)}</div>
              </div>
            </div>
          )}

          <div className="dashboard-grid">
            {/* Aportes + Fechamentos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Aportes Avulsos */}
              <div className="card">
                <h3 className="card-title">1. Aportes Avulsos</h3>
                <p className="card-desc">Registre cada transferência para a corretora.</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <input type="date" className="form-control" value={newDeposit.date} onChange={e => setNewDeposit({ ...newDeposit, date: e.target.value })} />
                  <input type="number" className="form-control" placeholder="R$ 150,00" value={newDeposit.amount} onChange={e => setNewDeposit({ ...newDeposit, amount: e.target.value })} />
                  <button className="btn" style={{ background: '#1d1d1f', color: '#fff', whiteSpace: 'nowrap' }} onClick={addDeposit}>Aportar</button>
                </div>
                <ul className="list-group" style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '1rem' }}>
                  {!deposits.length
                    ? <li className="list-item text-muted">Nenhum aporte registrado.</li>
                    : deposits.map(d => (
                      <li key={d.id} className="list-item" style={{ padding: '0.5rem 0' }}>
                        <span style={{ fontSize: '0.85rem' }}>{fmtDate(d.date)}</span>
                        <span style={{ fontWeight: 500 }}>R$ {d.amount.toFixed(2)}</span>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff3b30' }} onClick={() => removeDeposit(d.id)}><Trash2 size={13} /></button>
                      </li>
                    ))}
                </ul>
              </div>

              {/* Fechamento Mensal */}
              <div className="card">
                <h3 className="card-title">2. Fechamento Mensal</h3>
                <p className="card-desc">Declare o saldo real da carteira por mês para calcular rentabilidade.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Mês do Fechamento</label>
                    <input type="month" className="form-control" value={newInv.month} onChange={e => setNewInv({ ...newInv, month: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Saldo Real na Carteira (R$)</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input type="number" className="form-control" placeholder="10550,00" value={newInv.total} onChange={e => setNewInv({ ...newInv, total: e.target.value })} />
                      <button className="btn" style={{ background: '#1d1d1f', color: '#fff', whiteSpace: 'nowrap' }} onClick={addInvestmentRecord}>Consolidar</button>
                    </div>
                  </div>
                </div>
                <ul className="list-group" style={{ maxHeight: '260px', overflowY: 'auto', marginTop: '1rem' }}>
                  {!invWithRent.length
                    ? <li className="list-item text-muted">Nenhum fechamento mensal.</li>
                    : invWithRent.map(inv => (
                      <li key={inv.id} className="list-item" style={{ padding: '0.75rem 0' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{fmtMonth(inv.month)}</div>
                          <div className="text-muted" style={{ fontSize: '0.8rem' }}>Aportes do mês: R$ {inv.aportesDoMes.toFixed(2)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 600, fontSize: '1rem' }}>R$ {inv.realValue.toFixed(2)}</div>
                          <div className={inv.rentMonth > 0 ? 'green' : inv.rentMonth < 0 ? 'red' : 'text-muted'} style={{ fontSize: '0.8rem' }}>
                            {inv.rentMonth > 0 ? '+' : ''}{inv.rentMonth.toFixed(2)}% M/M
                          </div>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff3b30', fontSize: '0.72rem' }} onClick={() => removeInvestment(inv.id)}><Trash2 size={11} /></button>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            </div>

            {/* Curva S */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 className="card-title" style={{ marginBottom: 0 }}>Curva de Projeção & Patrimônio</h3>
                  <p className="card-desc" style={{ marginBottom: 0, fontSize: '0.8rem' }}>Histórico real + projeção automática 12 meses.</p>
                </div>
                <div style={{ display: 'flex', gap: '2px', background: '#f5f5f7', padding: '3px', borderRadius: '8px', border: '1px solid #e5e5ea' }}>
                  {[['6', '6M'], ['12', '12M'], ['all', 'Total']].map(([v, l]) => (
                    <button key={v} onClick={() => { setInvFilter(v); setShowInvTray(false) }} style={{
                      padding: '3px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                      background: invFilter === v ? '#1d1d1f' : 'transparent', color: invFilter === v ? '#fff' : '#86868b'
                    }}>{l}</button>
                  ))}
                  <button onClick={() => setShowInvTray(!showInvTray)} style={{ background: typeof invFilter === 'object' ? '#1d1d1f' : 'transparent', color: typeof invFilter === 'object' ? '#fff' : '#86868b', border: 'none', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>
                    Datas
                  </button>
                </div>
              </div>

              {showInvTray && (
                <div style={{ background: '#f5f5f7', padding: '1rem', borderRadius: '10px', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.8rem', alignItems: 'flex-end' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>Mês Específico</label>
                    <input type="month" className="form-control" style={{ fontSize: '0.8rem' }} value={invCustom.month} onChange={e => setInvCustom({ ...invCustom, month: e.target.value })} />
                  </div>
                  <span style={{ color: '#86868b', fontSize: '0.75rem', fontWeight: 700, paddingBottom: '4px' }}>OU</span>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>De:</label>
                    <input type="month" className="form-control" style={{ fontSize: '0.8rem' }} value={invCustom.start} onChange={e => setInvCustom({ ...invCustom, start: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>Até:</label>
                    <input type="month" className="form-control" style={{ fontSize: '0.8rem' }} value={invCustom.end} onChange={e => setInvCustom({ ...invCustom, end: e.target.value })} />
                  </div>
                  <button className="btn" style={{ background: '#1d1d1f', color: '#fff', fontSize: '0.8rem', padding: '0.4rem 1rem' }} onClick={() => {
                    if (invCustom.month) setInvFilter({ type: 'month', val: invCustom.month })
                    else if (invCustom.start && invCustom.end) setInvFilter({ type: 'range', start: invCustom.start, end: invCustom.end })
                    else alert('Selecione mês ou informe De e Até.')
                    setShowInvTray(false)
                  }}>Filtrar S-Curve</button>
                </div>
              )}

              <div style={{ flex: 1, minHeight: '380px' }}>
                <CanvasChart id="invChart" buildChart={(ctx) => new Chart(ctx, {
                  type: 'line',
                  data: {
                    labels: invChartData.labels,
                    datasets: [
                      { label: 'Patrimônio Realizado', data: invChartData.dataReal, borderColor: '#1d1d1f', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#1d1d1f', tension: 0.1 },
                      { label: 'Projeção (Base Médias)', data: invChartData.dataProj, borderColor: 'rgba(134,134,139,0.5)', borderDash: [5, 5], borderWidth: 2, fill: false, pointRadius: 0, tension: 0.2 },
                      { label: 'Aporte Bruto Acumulado', data: invChartData.dataAportes, borderColor: '#e5e5ea', borderWidth: 1, fill: true, backgroundColor: 'rgba(229,229,234,0.3)', pointRadius: 0 }
                    ]
                  },
                  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { grid: { color: 'rgba(0,0,0,0.04)' } }, x: { grid: { display: false } } } }
                })} />
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}


