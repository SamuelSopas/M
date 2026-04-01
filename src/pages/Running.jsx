import React, { useState, useMemo, useRef, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAppContext } from '../context/AppContext'
import { Trash2, ChevronDown, ChevronUp, Zap, Calendar } from 'lucide-react'
import { format, subDays, subMonths, subYears, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

const TRAINING_TYPES = [
  'Corrida Leve', 'Moderada', 'Tiro / Velocidade', 'Longão',
  'Regenerativo', 'Prova Oficial', 'Fartlek', 'Outro'
]

const DIFF_LABELS = {
  '1': '1 - Recreação (Muito Fácil)', '2': '2 - Fácil (Bate Papo)', '3': '3 - Leve (Zona 2)',
  '4': '4 - Controlado (Suave)', '5': '5 - Moderado (Começa a ofegar)', '6': '6 - Exigente (Limiar 1)',
  '7': '7 - Difícil (Passo de prova)', '8': '8 - Muito Difícil (Fôlego Curto)',
  '9': '9 - Extremo (Limiar 2)', '10': '10 - A Beira do Abismo (Tiro Máximo)'
}

const DIFF_SHORT = ['', 'Recreação', 'Fácil', 'Leve', 'Controlado', 'Moderado', 'Exigente', 'Difícil', 'Muito Difícil', 'Extremo', 'All Out']

export default function Running() {
  const { appData, updateAppData } = useAppContext()
  const [isAdvanced, setIsAdvanced] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0], local: '', distance: '', time: '',
    type: 'Corrida Leve', shoes: '', hasPlan: 'nao', planName: '',
    difficulty: '1', route: '', realPace: '', notes: ''
  })

  // Chart State
  const [chartFilter, setChartFilter] = useState('30d')
  const [showCustom, setShowCustom] = useState(false)
  const [customRange, setCustomRange] = useState({ start: '', end: '' })
  const chartRef = useRef(null)
  const chartInst = useRef(null)

  if (!appData) return <div style={{ padding: '2rem', textAlign: 'center', color: '#86868b' }}>Carregando...</div>
  const runs = appData.runningBuffer || []

  // ── Pace/Speed calc ───────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const dist = parseFloat((form.distance || '').replace(',', '.'))
    if (!dist || dist <= 0 || !form.time) return null
    const pts = form.time.split(':').map(Number)
    let totalMins = 0
    if (pts.length === 2 && pts.every(v => !isNaN(v))) totalMins = pts[0] + pts[1] / 60
    else if (pts.length === 3 && pts.every(v => !isNaN(v))) totalMins = pts[0] * 60 + pts[1] + pts[2] / 60
    else return null
    if (totalMins <= 0) return null
    const pace = totalMins / dist
    const pM = Math.floor(pace), pS = Math.round((pace - pM) * 60)
    const speed = dist / (totalMins / 60)
    return {
      pace: `${String(pM).padStart(2, '0')}:${String(pS).padStart(2, '0')} min/km`,
      speed: `${speed.toFixed(1)} km/h`
    }
  }, [form.distance, form.time])

  // ── Chart Logic ───────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const now = new Date()
    let startDate
    if (chartFilter === '7d') startDate = subDays(now, 6)
    else if (chartFilter === '30d') startDate = subDays(now, 29)
    else if (chartFilter === 'year') startDate = subYears(now, 1)
    else if (chartFilter === 'custom' && customRange.start && customRange.end) startDate = parseISO(customRange.start)
    else startDate = subDays(now, 29)

    const labels = []
    const distances = []
    let curr = startOfDay(startDate)
    const end = endOfDay(now) // always up to today for running

    while (curr <= end) {
      const dKey = format(curr, 'yyyy-MM-dd')
      labels.push(format(curr, 'dd/MM'))
      const dayRuns = runs.filter(r => r.date === dKey)
      const totalDist = dayRuns.reduce((sum, r) => sum + r.distance, 0)
      distances.push(totalDist)
      curr.setDate(curr.getDate() + 1)
    }
    return { labels, distances }
  }, [runs, chartFilter, customRange])

  useEffect(() => {
    if (!chartRef.current) return
    if (chartInst.current) chartInst.current.destroy()
    chartInst.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: [{ label: 'Distância (km)', data: chartData.distances, backgroundColor: '#ff3b30', borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } }
      }
    })
    return () => { if (chartInst.current) chartInst.current.destroy() }
  }, [chartData])

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = () => {
    if (!form.date || !form.local || !form.distance || !form.time)
      return alert('Preencha a Data, Local, Distância e o Tempo obrigatoriamente!')
    const dist = parseFloat(form.distance.replace(',', '.'))
    if (isNaN(dist) || dist <= 0) return alert('Distância inválida.')

    const run = {
      id: 'RUN_' + Date.now() + Math.random().toString(36).substr(2, 5),
      date: form.date, local: form.local, distance: dist,
      timeRaw: form.time,
      paceStr: metrics?.pace || 'N/A', speedStr: metrics?.speed || 'N/A',
      isAdvanced,
      ...(isAdvanced && {
        trainingType: form.type, shoes: form.shoes,
        hasPlan: form.hasPlan === 'sim', planName: form.planName,
        difficulty: form.difficulty, route: form.route,
        realPace: form.realPace, notes: form.notes
      })
    }

    updateAppData(prev => ({
      ...prev,
      runningBuffer: [...(prev.runningBuffer || []), run].sort((a, b) => new Date(b.date) - new Date(a.date))
    }))

    setForm({ ...form, local: '', distance: '', time: '', shoes: '', planName: '', difficulty: '1', route: '', realPace: '', notes: '' })
    alert(`Corrida de ${dist} km salva! Pace: ${run.paceStr}`)
  }

  const remove = (id) => {
    if (!confirm('Apagar este registro de corrida?')) return
    updateAppData(prev => ({ ...prev, runningBuffer: prev.runningBuffer.filter(r => r.id !== id) }))
  }

  const F = (k, v) => setForm({ ...form, [k]: v })

  return (
    <Layout title="Corridas" subtitle="Registro supersônico e dossiê avançado de treinos.">
      <div className="dashboard-grid">

        {/* ── COLUNA ESQUERDA: FORM ── */}
        <div className="card" style={{ borderTop: '4px solid #ff3b30' }}>
          <h3 style={{ marginBottom: '1.5rem', textAlign: 'center', color: '#ff3b30' }}>Novo Rastreamento (Pace Automático)</h3>

          {/* Basic */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Data *</label>
              <input type="date" className="form-control" value={form.date} onChange={e => F('date', e.target.value)} /></div>
            <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Local / Trajeto *</label>
              <input className="form-control" placeholder="Ex: Parque Ibirapuera" value={form.local} onChange={e => F('local', e.target.value)} /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Distância (km) *</label>
              <input className="form-control" placeholder="Ex: 5" value={form.distance} onChange={e => F('distance', e.target.value)} /></div>
            <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Tempo Total *</label>
              <input className="form-control" placeholder="Ex: 25:30 (mm:ss)" value={form.time} onChange={e => F('time', e.target.value)} /></div>
          </div>

          {/* Auto metrics display */}
          {metrics && (
            <div style={{ background: 'rgba(255,59,48,0.05)', border: '1px dashed rgba(255,59,48,0.3)', padding: '1rem', borderRadius: '10px', marginBottom: '1.5rem', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#86868b', textTransform: 'uppercase', fontWeight: 600 }}>Pace Médio</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ff3b30' }}>{metrics.pace}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#86868b', textTransform: 'uppercase', fontWeight: 600 }}>Veloc. Média</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ff3b30' }}>{metrics.speed}</div>
                </div>
              </div>
            </div>
          )}

          {/* Advanced */}
          {isAdvanced && (
            <div style={{ borderTop: '1px solid #e5e5ea', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Intenção de Treino</label>
                  <select className="form-control" value={form.type} onChange={e => F('type', e.target.value)}>
                    {TRAINING_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select></div>
                <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Tênis Calçado</label>
                  <input className="form-control" placeholder="Marca/Modelo" value={form.shoes} onChange={e => F('shoes', e.target.value)} /></div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: '0 0 140px' }}><label className="form-label" style={{ fontSize: '0.8rem' }}>Prescrição?</label>
                  <select className="form-control" value={form.hasPlan} onChange={e => F('hasPlan', e.target.value)}>
                    <option value="nao">Livre</option><option value="sim">Planilha</option>
                  </select></div>
                {form.hasPlan === 'sim' && (
                  <div style={{ flex: 1, minWidth: '200px' }}><label className="form-label" style={{ fontSize: '0.8rem' }}>Nome da Sessão</label>
                    <input className="form-control" placeholder="Ex: Trote Progressivo" value={form.planName} onChange={e => F('planName', e.target.value)} /></div>
                )}
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Exaustão (Esforço)</label>
                  <span style={{ color: '#ff3b30', fontWeight: 700, fontSize: '0.8rem' }}>{DIFF_LABELS[form.difficulty]}</span>
                </div>
                <input type="range" min="1" max="10" value={form.difficulty} onChange={e => F('difficulty', e.target.value)}
                  style={{ width: '100%', accentColor: '#ff3b30' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Percurso Descritivo</label>
                  <input className="form-control" placeholder="Casa > Lagoa > Retorno" value={form.route} onChange={e => F('route', e.target.value)} /></div>
                <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Pace Real (Apple/Garmin)</label>
                  <input className="form-control" placeholder="Ex: 5:45 min/km" value={form.realPace} onChange={e => F('realPace', e.target.value)} /></div>
              </div>

              <div><label className="form-label" style={{ fontSize: '0.8rem' }}>Observações Biomédicas e de Terreno</label>
                <textarea className="form-control" rows={2} placeholder="Dores, clima, sensações..."
                  value={form.notes} onChange={e => F('notes', e.target.value)} /></div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
            <button className="btn" style={{ background: '#ff3b30', color: '#fff', width: '100%', border: 'none' }} onClick={save}>
              📥 Finalizar e Salvar Corrida
            </button>
            <button className="btn btn-secondary" style={{ width: '100%', border: 'none', fontSize: '0.85rem' }} onClick={() => setIsAdvanced(!isAdvanced)}>
              {isAdvanced ? <><ChevronUp size={14} /> Ocultar Dossiê Pessoal</> : <><ChevronDown size={14} /> Mais opções / Dossiê Personalizado</>}
            </button>
          </div>
        </div>

        {/* ── COLUNA DIREITA: CHART + FEED ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* CHART CARD */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.5rem' }}>
               <div>
                 <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Volume de Treinos</h3>
                 <p style={{ color: '#86868b', fontSize: '0.8rem', margin: 0 }}>Distância percorrida por dia.</p>
               </div>
               <div style={{ display: 'flex', gap: '2px', background: '#f5f5f7', padding: '3px', borderRadius: '8px', border: '1px solid #e5e5ea' }}>
                  {[['7d', '7D'], ['30d', '30D'], ['year', 'Ano']].map(([v, l]) => (
                    <button key={v} onClick={() => { setChartFilter(v); setShowCustom(false) }} style={{
                      padding: '3px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                      background: chartFilter === v ? '#1d1d1f' : 'transparent', color: chartFilter === v ? '#fff' : '#86868b'
                    }}>{l}</button>
                  ))}
                  <button onClick={() => setShowCustom(!showCustom)} style={{
                     padding: '3px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                     background: chartFilter === 'custom' ? '#1d1d1f' : 'transparent', color: chartFilter === 'custom' ? '#fff' : '#86868b'
                  }}>Datas</button>
               </div>
            </div>

            {showCustom && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: '#f5f5f7', padding: '0.6rem', borderRadius: '8px', alignItems: 'flex-end' }}>
                 <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#86868b' }}>De:</label>
                 <input type="date" className="form-control" style={{ fontSize: '0.8rem', padding: '4px' }} value={customRange.start} onChange={e => setCustomRange({...customRange, start: e.target.value})} /></div>
                 <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#86868b' }}>Até:</label>
                 <input type="date" className="form-control" style={{ fontSize: '0.8rem', padding: '4px' }} value={customRange.end} onChange={e => setCustomRange({...customRange, end: e.target.value})} /></div>
                 <button className="btn" style={{ fontSize: '0.7rem', padding: '6px 12px', background: '#1d1d1f', color: '#fff' }} onClick={() => setChartFilter('custom')}>Filtrar</button>
              </div>
            )}

            <div style={{ height: '220px' }}>
              <canvas ref={chartRef} />
            </div>
          </div>

          {/* FEED */}
          <div>
          <h3 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>🏆 Minhas Conquistas no Asfalto</h3>
          {runs.length === 0
            ? <p style={{ color: '#86868b', textAlign: 'center', padding: '2rem', border: '1px dashed #d2d2d7', borderRadius: '12px' }}>
                Asfalto limpo. Registre sua primeira corrida acima!
              </p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {runs.map(r => (
                  <div key={r.id} className="card" style={{ padding: '1.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#86868b', textTransform: 'uppercase' }}>
                        {r.date.split('-').reverse().join('/')} | {r.local}
                      </span>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff3b30' }} onClick={() => remove(r.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '2rem', margin: 0 }}>{r.distance.toFixed(2)} <span style={{ fontSize: '1rem' }}>km</span></h3>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700 }}>⏱ {r.timeRaw || r.time}</div>
                        <div style={{ fontSize: '0.9rem', color: '#ff3b30', fontWeight: 700 }}>
                          <Zap size={10} style={{ display: 'inline' }} /> {r.realPace ? `${r.realPace} (Real)` : r.paceStr}{!r.realPace && ` | ${r.speedStr}`}
                        </div>
                      </div>
                    </div>

                    {/* Advanced dossier */}
                    {r.isAdvanced && (
                      <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px dashed #e5e5ea', fontSize: '0.82rem', color: '#555' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <b>{r.trainingType || 'Trote'}</b>
                          <span>Esforço: {r.difficulty} - {DIFF_SHORT[r.difficulty] || ''}</span>
                        </div>
                        {r.shoes && <div style={{ marginBottom: '0.2rem' }}>👟 <b>Armadura:</b> {r.shoes}</div>}
                        {r.hasPlan && r.planName && <div style={{ marginBottom: '0.2rem' }}>📋 <b>Sessão:</b> {r.planName}</div>}
                        {r.route && <div style={{ marginBottom: '0.2rem' }}>📍 <b>Percurso:</b> {r.route}</div>}
                        {r.notes && <div style={{ marginTop: '0.5rem', fontStyle: 'italic', borderLeft: '2px solid #ff3b30', paddingLeft: '0.5rem' }}>"{r.notes}"</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
          }
          </div>
        </div>
      </div>
    </Layout>
  )
}
