import React, { useState, useEffect, useRef, useMemo } from 'react'
import Layout from '../components/Layout'
import { useAppContext } from '../context/AppContext'
import { Plus, Trash2, ArrowUp, ArrowDown, Flame, TrendingUp, Award } from 'lucide-react'
import { Chart, registerables } from 'chart.js'
import { subDays, subMonths, subYears, format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
Chart.register(...registerables)

// ─── helpers ────────────────────────────────────────────────────────────────
const getTodayStr = () => new Date().toISOString().split('T')[0]

const getPast7Days = () => {
  const dates = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

const fmtDay = (iso) => { const [,, d, m] = [...iso.split('-'), iso.split('-')[1]]; return `${iso.split('-')[2]}/${iso.split('-')[1]}` }

const calcStreak = (logs, habitId, habitsCount) => {
  let streak = 0
  let ptr = new Date()
  const todayStr = ptr.toISOString().split('T')[0]

  if (habitId === 'ALL') {
    const done = (d) => logs.filter(l => l.dateKey === d && l.status).length
    if (done(todayStr) === habitsCount && habitsCount > 0) streak++
    ptr.setDate(ptr.getDate() - 1)
    while (true) {
      const dStr = ptr.toISOString().split('T')[0]
      if (done(dStr) === habitsCount && habitsCount > 0) { streak++; ptr.setDate(ptr.getDate() - 1) }
      else break
    }
  } else {
    const done = (d) => logs.some(l => l.dateKey === d && l.habitId === habitId && l.status)
    if (done(todayStr)) streak++
    ptr.setDate(ptr.getDate() - 1)
    while (true) {
      const dStr = ptr.toISOString().split('T')[0]
      if (done(dStr)) { streak++; ptr.setDate(ptr.getDate() - 1) }
      else break
    }
  }
  return streak
}

// ─── component ───────────────────────────────────────────────────────────────
export default function Habits() {
  const { appData, updateAppData } = useAppContext()
  const [tab, setTab] = useState('daily') // 'daily' | 'monthly'
  const [newName, setNewName] = useState('')
  const [newMetric, setNewMetric] = useState('')
  const [selectedHabit, setSelectedHabit] = useState('ALL')
  const [metricPrompt, setMetricPrompt] = useState(null) // { habitId, unit }
  const [metricValue, setMetricValue] = useState('')

  // Chart & Filter State (Added missing state)
  const [chartFilter, setChartFilter] = useState('7d')
  const [showCustomRange, setShowCustomRange] = useState(false)
  const [customRange, setCustomRange] = useState({ start: '', end: '' })
  const chartRef = useRef(null)
  const chartInst = useRef(null)

  if (!appData) return <div style={{ padding: '2rem', textAlign: 'center', color: '#86868b' }}>Carregando...</div>

  const habits = appData.habitsBuffer || []
  const logs = appData.habitsLogsBuffer || []
  const today = getTodayStr()
  const past7 = getPast7Days()

  // ── Actions ───────────────────────────────────────────────────────────────
  const addHabit = () => {
    if (!newName.trim()) return
    const habit = {
      id: 'H_' + Date.now(),
      name: newName.trim(),
      metricUnit: newMetric.trim() || null,
      hasMetric: newMetric.trim().length > 0,
      createdStr: today
    }
    updateAppData(prev => ({ ...prev, habitsBuffer: [...(prev.habitsBuffer || []), habit] }))
    setNewName('')
    setNewMetric('')
  }

  const removeHabit = (id) => {
    if (!confirm('Remover este hábito e todos os seus registros?')) return
    updateAppData(prev => ({
      ...prev,
      habitsBuffer: (prev.habitsBuffer || []).filter(h => h.id !== id),
      habitsLogsBuffer: (prev.habitsLogsBuffer || []).filter(l => l.habitId !== id)
    }))
  }

  const moveHabit = (idx, dir) => {
    const arr = [...habits]
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
    updateAppData(prev => ({ ...prev, habitsBuffer: arr }))
  }

  const toggleHabit = (habitId, hasMetric, metricUnit) => {
    const alreadyDone = logs.some(l => l.dateKey === today && l.habitId === habitId && l.status)
    if (alreadyDone) {
      // Uncheck
      updateAppData(prev => ({
        ...prev,
        habitsLogsBuffer: (prev.habitsLogsBuffer || []).filter(l => !(l.dateKey === today && l.habitId === habitId))
      }))
      return
    }
    if (hasMetric) {
      setMetricPrompt({ habitId, unit: metricUnit })
      setMetricValue('')
      return
    }
    updateAppData(prev => ({
      ...prev,
      habitsLogsBuffer: [...(prev.habitsLogsBuffer || []), { dateKey: today, habitId, status: true, value: null }]
    }))
  }

  const confirmMetric = () => {
    const val = parseFloat(metricValue)
    if (isNaN(val)) return alert('Valor numérico inválido.')
    updateAppData(prev => ({
      ...prev,
      habitsLogsBuffer: [...(prev.habitsLogsBuffer || []).filter(l => !(l.dateKey === today && l.habitId === metricPrompt.habitId)),
        { dateKey: today, habitId: metricPrompt.habitId, status: true, value: val }]
    }))
    setMetricPrompt(null)
    setMetricValue('')
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const doneTodayCount = logs.filter(l => l.dateKey === today && l.status).length
  const dailyRate = habits.length > 0 ? (doneTodayCount / habits.length) * 100 : 0
  const weekData = past7.map(d => logs.filter(l => l.dateKey === d && l.status).length)
  const totalWeek = habits.length * 7
  const weekRate = totalWeek > 0 ? (weekData.reduce((a, b) => a + b, 0) / totalWeek) * 100 : 0

  // ── Ranking ───────────────────────────────────────────────────────────────
  const ranking = habits
    .map(h => ({ ...h, cnt: logs.filter(l => l.habitId === h.id && l.status).length }))
    .sort((a, b) => b.cnt - a.cnt)

  // ── Streak stats ──────────────────────────────────────────────────────────
  const thisMonthPrefix = today.substring(0, 7)
  const streak = calcStreak(logs, selectedHabit, habits.length)
  const thisMonth = selectedHabit === 'ALL'
    ? logs.filter(l => l.dateKey.startsWith(thisMonthPrefix) && l.status).length
    : logs.filter(l => l.dateKey.startsWith(thisMonthPrefix) && l.habitId === selectedHabit && l.status).length
  const lifeTotal = selectedHabit === 'ALL'
    ? logs.filter(l => l.status).length
    : logs.filter(l => l.habitId === selectedHabit && l.status).length

  // -- Water KPI Logic (v1.4) --
  const mlHabits = habits.filter(h => h.metricUnit?.toLowerCase().includes('ml'))
  const hasWaterHabit = mlHabits.length > 0
  const todayWaterML = logs
    .filter(l => l.dateKey === today && l.status && mlHabits.some(mh => mh.id === l.habitId))
    .reduce((acc, l) => acc + (Number(l.value) || 0), 0)

  // ── Unified Chart Logic ──────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const now = new Date()
    let startDate, endDate = now

    if (chartFilter === '7d') startDate = subDays(now, 6)
    else if (chartFilter === '30d') startDate = subDays(now, 29)
    else if (chartFilter === 'year') startDate = subYears(now, 1)
    else if (chartFilter === 'custom' && customRange.start && customRange.end) {
      startDate = parseISO(customRange.start)
      endDate = parseISO(customRange.end)
    } else {
      startDate = subDays(now, 6) // Fallback
    }

    const labels = []
    const data = []
    const metas = []
    
    let curr = startOfDay(startDate)
    const end = endOfDay(endDate)

    while (curr <= end) {
      const dKey = format(curr, 'yyyy-MM-dd')
      labels.push(format(curr, 'dd/MM'))
      const dayLogs = logs.filter(l => l.dateKey === dKey && l.status)
      data.push(dayLogs.length)
      metas.push(habits.length)
      curr.setDate(curr.getDate() + 1)
    }

    return { labels, data, metas }
  }, [chartFilter, customRange, logs, habits.length])

  useEffect(() => {
    if (!chartRef.current) return
    if (chartInst.current) chartInst.current.destroy()

    chartInst.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: [
          { label: 'Concluídos', data: chartData.data, backgroundColor: '#1d1d1f', borderRadius: 4 },
          { label: 'Meta', type: 'line', data: chartData.metas, borderColor: 'rgba(134,134,139,0.3)', borderDash: [5, 5], fill: false, pointRadius: 0 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } }
      }
    })

    return () => { if (chartInst.current) chartInst.current.destroy() }
  }, [chartData])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Layout title="Controle de Hábitos" subtitle="Rotina Diária, Consistência Semanal e Evolução Mensal / Anual">

      {/* ── DAILY TAB (Now Unified with Dynamic Chart) ── */}
      <div className="dashboard-grid">

        {/* Coluna Esquerda - Lista de hábitos */}

          {/* Coluna Esquerda - Lista de hábitos */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 className="card-title">Hábitos do Dia</h3>
                <p className="card-desc">Marque o que já foi finalizado para atualizar o desempenho.</p>
              </div>
              <span style={{ color: '#86868b', fontSize: '0.85rem', fontWeight: 500 }}>Hoje, {today.split('-').reverse().slice(0, 2).join('/')}</span>
            </div>

            {/* Form de adicionar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
              <div style={{ flex: 2, minWidth: '180px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Nome do Hábito</label>
                <input className="form-control" placeholder="Ex: Treino, Água, Ler..." value={newName}
                  onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addHabit()} />
              </div>
              <div style={{ width: '130px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Métrica (Opcional)</label>
                <input className="form-control" placeholder="Ex: km, ml" value={newMetric}
                  onChange={e => setNewMetric(e.target.value)} />
              </div>
              <button className="btn" style={{ background: '#1d1d1f', color: '#fff', height: '42px', display: 'flex', alignItems: 'center', gap: '5px' }} onClick={addHabit}>
                <Plus size={16} />Cadastrar
              </button>
            </div>

            {/* KPIs (Now below form and smaller - Expanded to 4 for Water) */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${hasWaterHabit ? 4 : 3}, 1fr)`, gap: '0.6rem', marginBottom: '1.5rem', marginTop: '1rem' }}>
              {[
                { label: 'Hoje', value: `${doneTodayCount}/${habits.length}`, color: doneTodayCount === habits.length && habits.length > 0 ? '#30d158' : undefined },
                { label: 'Diária', value: `${dailyRate.toFixed(0)}%` },
                { label: 'Semanal', value: `${weekRate.toFixed(0)}%`, color: weekRate > 80 ? '#30d158' : weekRate < 50 ? '#ff3b30' : undefined },
                ...(hasWaterHabit ? [{ label: 'Água', value: `${todayWaterML}ml`, color: todayWaterML >= 2000 ? '#007aff' : undefined }] : [])
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: '#f5f5f7', borderRadius: '10px', padding: '0.6rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', color: '#86868b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{label}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: color || '#1d1d1f' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Lista de hábitos */}
            {habits.length === 0
              ? <p style={{ color: '#86868b', textAlign: 'center', padding: '2rem', border: '1px dashed #d2d2d7', borderRadius: '12px', fontSize: '0.9rem' }}>
                  Nenhum hábito rastreado. Comece adicionando acima.
                </p>
              : habits.map((h, idx) => {
                const todayLog = logs.find(l => l.dateKey === today && l.habitId === h.id && l.status)
                const isDone = !!todayLog
                return (
                  <div key={h.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.8rem 0', borderBottom: '1px solid #f0f0f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1, cursor: 'pointer' }}
                      onClick={() => toggleHabit(h.id, h.hasMetric, h.metricUnit)}>
                      {/* Checkbox */}
                      <div style={{
                        width: 24, height: 24, borderRadius: '6px', border: `2px solid ${isDone ? '#30d158' : '#d2d2d7'}`,
                        background: isDone ? '#30d158' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {isDone && <span style={{ color: '#fff', fontSize: '14px', lineHeight: 1 }}>✓</span>}
                      </div>
                      <div>
                        <span style={{ fontWeight: 500, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#86868b' : '#1d1d1f' }}>{h.name}</span>
                        {h.hasMetric && (
                          <span style={{ marginLeft: 8, fontSize: '0.72rem', background: isDone ? '#e8f9f0' : '#f5f5f7', color: isDone ? '#30d158' : '#86868b', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {isDone && todayLog?.value != null ? `${todayLog.value} ${h.metricUnit}` : `[ ${h.metricUnit} ]`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86868b', padding: '2px 4px' }} onClick={() => moveHabit(idx, -1)} disabled={idx === 0}><ArrowUp size={13} /></button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86868b', padding: '2px 4px' }} onClick={() => moveHabit(idx, 1)} disabled={idx === habits.length - 1}><ArrowDown size={13} /></button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff3b30', padding: '2px 4px' }} onClick={() => removeHabit(h.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Coluna Direita - Gráfico + Ranking */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 className="card-title" style={{ marginBottom: 0 }}>Histórico de Performance</h3>
                  <p className="card-desc">Visão detalhada do seu compromisso.</p>
                </div>
                <div style={{ display: 'flex', gap: '2px', background: '#f5f5f7', padding: '3px', borderRadius: '8px', border: '1px solid #e5e5ea' }}>
                   {[['7d', '7D'], ['30d', '30D'], ['year', 'Ano']].map(([v, l]) => (
                     <button key={v} onClick={() => { setChartFilter(v); setShowCustomRange(false) }} style={{
                       padding: '3px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                       background: chartFilter === v ? '#1d1d1f' : 'transparent', color: chartFilter === v ? '#fff' : '#86868b'
                     }}>{l}</button>
                   ))}
                   <button onClick={() => setShowCustomRange(!showCustomRange)} style={{
                      padding: '3px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                      background: chartFilter === 'custom' ? '#1d1d1f' : 'transparent', color: chartFilter === 'custom' ? '#fff' : '#86868b'
                   }}>Datas</button>
                </div>
              </div>

              {showCustomRange && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: '#f5f5f7', padding: '0.6rem', borderRadius: '8px', alignItems: 'flex-end' }}>
                   <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#86868b' }}>De:</label>
                   <input type="date" className="form-control" style={{ fontSize: '0.8rem', padding: '4px' }} value={customRange.start} onChange={e => setCustomRange({...customRange, start: e.target.value})} /></div>
                   <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#86868b' }}>Até:</label>
                   <input type="date" className="form-control" style={{ fontSize: '0.8rem', padding: '4px' }} value={customRange.end} onChange={e => setCustomRange({...customRange, end: e.target.value})} /></div>
                   <button className="btn" style={{ fontSize: '0.7rem', padding: '6px 12px' }} onClick={() => setChartFilter('custom')}>Filtrar</button>
                </div>
              )}

              <div style={{ height: '220px' }}>
                <canvas ref={chartRef} />
              </div>
            </div>

            <div className="card">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={18} /> Top Hábitos
              </h3>
              <p className="card-desc">Organização por consistência da rotina.</p>
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ranking.length === 0
                  ? <p style={{ color: '#86868b', fontSize: '0.85rem' }}>Sem dados ainda.</p>
                  : ranking.slice(0, 3).map((h, i) => (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem', background: '#f5f5f7', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '1rem' }}>{['🥇', '🥈', '🥉'][i]}</span>
                        <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{h.name}</span>
                      </div>
                      <span style={{ color: '#86868b', fontSize: '0.8rem' }}>{h.cnt} dias</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>


      {/* ── Modal Métrica ── */}
      {metricPrompt && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '360px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Registrar Métrica</h3>
            <p style={{ color: '#86868b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Quantos <strong>{metricPrompt.unit}</strong> você realizou hoje?
            </p>
            <input className="form-control" type="number" placeholder="0" value={metricValue}
              onChange={e => setMetricValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmMetric()}
              style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}
              autoFocus />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setMetricPrompt(null)}>Cancelar</button>
              <button className="btn" style={{ flex: 2, background: '#1d1d1f', color: '#fff' }} onClick={confirmMetric}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
