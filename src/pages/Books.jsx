import React, { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { useAppContext } from '../context/AppContext'
import { Search, Loader, Trash2, X, BookOpen, Calendar } from 'lucide-react'
import { Chart, registerables } from 'chart.js'
import { subDays, subMonths, subYears, format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns'
Chart.register(...registerables)

const uid = () => Date.now().toString() + Math.random().toString(36).substr(2, 5)

export default function Books() {
  const { appData, updateAppData } = useAppContext()
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResult, setSearchResult] = useState(null) // null | 'not_found' | bookObj
  const [isSearching, setIsSearching] = useState(false)
  const [newBook, setNewBook] = useState({ title: '', author: '', totalPages: '', totalChapters: '', version: '', year: '', coverUrl: '' })
  const [modalIdx, setModalIdx] = useState(null)
  const [pageInput, setPageInput] = useState('')
  const [feedback, setFeedback] = useState(null)

  // Chart State for Modal
  const [modalFilter, setModalFilter] = useState('30d')
  const [showModalCustom, setShowModalCustom] = useState(false)
  const [modalCustomRange, setModalCustomRange] = useState({ start: '', end: '' })

  // Global catalog (localStorage)
  const [catalog, setCatalog] = useState(() => {
    const s = localStorage.getItem('hub_books_db')
    return s ? JSON.parse(s) : {}
  })
  useEffect(() => { localStorage.setItem('hub_books_db', JSON.stringify(catalog)) }, [catalog])

  if (!appData) return <div style={{ padding: '2rem', textAlign: 'center', color: '#86868b' }}>Carregando...</div>
  const books = appData.booksBuffer || []

  // ── Search ────────────────────────────────────────────────────────────────
  const doSearch = () => {
    if (!searchTerm.trim()) return
    const q = searchTerm.trim().toLowerCase()
    const foundId = Object.keys(catalog).find(id => catalog[id].title?.toLowerCase().includes(q))
    if (foundId) {
      setSearchResult({ ...catalog[foundId], id: foundId })
    } else {
      setSearchResult('not_found')
      setNewBook({ ...newBook, title: searchTerm.trim() })
    }
  }

  // ── Fetch cover from OpenLibrary ──────────────────────────────────────────
  const fetchCover = async () => {
    if (!newBook.title) return alert('Dê um título.')
    setIsSearching(true)
    try {
      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(newBook.title)}&limit=3`)
      const data = await res.json()
      const doc = data.docs.find(d => d.cover_i) || data.docs[0]
      if (doc) {
        const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : ''
        setNewBook(prev => ({
          ...prev,
          coverUrl: coverUrl || prev.coverUrl,
          author: prev.author || (doc.author_name?.[0] || ''),
          totalPages: prev.totalPages || String(doc.number_of_pages_median || ''),
          year: prev.year || String(doc.first_publish_year || '')
        }))
        alert(doc.cover_i ? 'Capa e dados obtidos da web!' : 'Dados obtidos, mas capa indisponível.')
      } else {
        alert('Nenhum resultado encontrado na API mundial.')
      }
    } catch { alert('Falha na comunicação com a API.') }
    finally { setIsSearching(false) }
  }

  // ── Save new book to global catalog ───────────────────────────────────────
  const saveNewBook = () => {
    const pages = parseInt(newBook.totalPages)
    if (!newBook.title.trim() || isNaN(pages) || pages <= 0) return alert('Título e nº de páginas são obrigatórios.')
    const id = uid()
    setCatalog(prev => ({
      ...prev,
      [id]: { id, title: newBook.title, author: newBook.author, totalPages: pages, totalChapters: newBook.totalChapters, version: newBook.version, year: newBook.year, coverUrl: newBook.coverUrl, addedBy: 'me' }
    }))
    if (confirm('Livro salvo no acervo! Deseja iniciar a leitura agora?')) {
      addToMyList(id, { title: newBook.title, author: newBook.author, totalPages: pages, coverUrl: newBook.coverUrl })
    }
    setSearchTerm('')
    setSearchResult(null)
    setNewBook({ title: '', author: '', totalPages: '', totalChapters: '', version: '', year: '', coverUrl: '' })
  }

  // ── Add to reading list ───────────────────────────────────────────────────
  const addToMyList = (bookId, bookData) => {
    if (books.find(b => b.bookId === bookId)) return alert('Já na estante!')
    const entry = {
      bookId, status: 'reading', pagesRead: 0, percentage: 0,
      startDate: new Date().toISOString().split('T')[0],
      completedDate: null, history: [],
      // Cache book info for rendering
      title: bookData?.title || '', author: bookData?.author || '',
      totalPages: bookData?.totalPages || 0, coverUrl: bookData?.coverUrl || ''
    }
    updateAppData(prev => ({ ...prev, booksBuffer: [...(prev.booksBuffer || []), entry] }))
    setSearchTerm('')
    setSearchResult(null)
  }

  const removeBook = (bookId) => {
    if (!confirm('Remover livro da estante?')) return
    updateAppData(prev => ({ ...prev, booksBuffer: prev.booksBuffer.filter(b => b.bookId !== bookId) }))
    setModalIdx(null)
  }

  // ── Progress registration ─────────────────────────────────────────────────
  const registerProgress = () => {
    if (modalIdx === null) return
    const b = books[modalIdx]
    const totalPages = catalog[b.bookId]?.totalPages || b.totalPages || 999
    const newPage = parseInt(pageInput)
    if (isNaN(newPage) || newPage <= b.pagesRead || newPage > totalPages) {
      return alert(`Página deve ser > ${b.pagesRead} e ≤ ${totalPages}.`)
    }
    const increment = newPage - b.pagesRead
    const pct = (newPage / totalPages) * 100
    const isComplete = newPage >= totalPages
    const now = new Date()

    updateAppData(prev => ({
      ...prev,
      booksBuffer: prev.booksBuffer.map((bk, i) => i !== modalIdx ? bk : {
        ...bk,
        pagesRead: newPage,
        percentage: pct,
        status: isComplete ? 'completed' : 'reading',
        completedDate: isComplete ? now.toISOString().split('T')[0] : null,
        history: [...(bk.history || []), { date: now.toISOString().split('T')[0], time: now.toTimeString().substring(0, 5), page_reached: newPage, increment }]
      })
    }))

    setFeedback({ increment, pct, isComplete })
    setPageInput('')
  }

  // ── Featured carousel ─────────────────────────────────────────────────────
  const featured = Object.values(catalog).sort(() => 0.5 - Math.random()).slice(0, 5)

  // ── Modal book data ───────────────────────────────────────────────────────
  const modalBook = modalIdx !== null ? books[modalIdx] : null
  const modalMeta = modalBook ? (catalog[modalBook.bookId] || { title: modalBook.title, author: modalBook.author, totalPages: modalBook.totalPages, coverUrl: modalBook.coverUrl }) : null

  return (
    <Layout title="Biblioteca do Hub" subtitle="Acervo geral de edições e controle privado de progresso da sua leitura.">

      {/* Featured Carousel */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '0.78rem', color: '#86868b', textTransform: 'uppercase', marginBottom: '0.8rem', letterSpacing: '0.05rem' }}>📖 Leituras da Comunidade</h4>
        <div style={{ display: 'flex', overflowX: 'auto', gap: '0.8rem', paddingBottom: '0.5rem' }}>
          {featured.length === 0
            ? <span style={{ color: '#86868b', fontSize: '0.8rem' }}>Acervo vazio.</span>
            : featured.map(b => (
              <div key={b.id} onClick={() => { setSearchTerm(b.title); setTimeout(() => doSearch(), 100) }} style={{
                minWidth: '160px', maxWidth: '160px', background: '#f5f5f7', borderLeft: '3px solid #007aff',
                padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', border: '1px solid #e5e5ea', flexShrink: 0
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</div>
                <div style={{ fontSize: '0.72rem', color: '#86868b', marginTop: '2px' }}>{b.author || 'Vários'}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="card-title">Acervo Global</h3>
        <p className="card-desc">Pesquise por títulos fichados ou adicione novos ao catálogo.</p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <input className="form-control" placeholder="Buscar título..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} />
          <button className="btn" style={{ background: '#1d1d1f', color: '#fff' }} onClick={doSearch} disabled={isSearching}>
            {isSearching ? <Loader size={16} className="spin" /> : <Search size={16} />}
          </button>
        </div>

        {/* Result: found */}
        {searchResult && searchResult !== 'not_found' && (
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', background: '#f5f5f7', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e5e5ea' }}>
            {searchResult.coverUrl
              ? <img src={searchResult.coverUrl} alt="" style={{ width: 80, height: 120, objectFit: 'cover', borderRadius: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
              : <div style={{ width: 80, height: 120, background: '#fff', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', border: '1px solid #e5e5ea' }}>📖</div>
            }
            <div style={{ flex: 1, minWidth: 200 }}>
              <h4 style={{ fontSize: '1.15rem', marginBottom: '0.2rem' }}>{searchResult.title}</h4>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>de {searchResult.author || 'Múltiplos'}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', fontSize: '0.82rem', color: '#86868b', marginBottom: '1rem' }}>
                <div>📖 {searchResult.totalPages} Págs</div>
                <div>📑 {searchResult.totalChapters || '?'} Cap.</div>
                <div>🔖 {searchResult.version || 'Única'}</div>
                <div>🏛️ Ano {searchResult.year || 'N/A'}</div>
              </div>
              {books.find(b => b.bookId === searchResult.id)
                ? <button className="btn" disabled style={{ opacity: 0.5 }}>Já na sua Estante</button>
                : <button className="btn" style={{ background: '#1d1d1f', color: '#fff' }} onClick={() => addToMyList(searchResult.id, searchResult)}>
                    Iniciar Leitura (+ Minha Estante)
                  </button>
              }
            </div>
          </div>
        )}

        {/* Result: not found → create */}
        {searchResult === 'not_found' && (
          <div style={{ marginTop: '1.5rem', background: '#f5f5f7', padding: '1.5rem', borderRadius: '12px', border: '1px dashed #007aff' }}>
            <p className="text-muted" style={{ marginBottom: '1rem' }}>
              O livro <strong>"{searchTerm}"</strong> não foi encontrado. Catalogue-o!
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input className="form-control" style={{ flex: 1, minWidth: 200 }} placeholder="Título *" value={newBook.title}
                  onChange={e => setNewBook({ ...newBook, title: e.target.value })} />
                <button className="btn btn-secondary" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }} onClick={fetchCover} disabled={isSearching}>
                  {isSearching ? '...' : '🔍 Puxar Capa da Web'}
                </button>
              </div>
              <input className="form-control" placeholder="Autor" value={newBook.author} onChange={e => setNewBook({ ...newBook, author: e.target.value })} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="number" className="form-control" placeholder="Páginas *" value={newBook.totalPages} onChange={e => setNewBook({ ...newBook, totalPages: e.target.value })} />
                <input type="number" className="form-control" placeholder="Capítulos" value={newBook.totalChapters} onChange={e => setNewBook({ ...newBook, totalChapters: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="form-control" placeholder="Edição" value={newBook.version} onChange={e => setNewBook({ ...newBook, version: e.target.value })} />
                <input type="number" className="form-control" placeholder="Ano" value={newBook.year} onChange={e => setNewBook({ ...newBook, year: e.target.value })} />
              </div>
              {newBook.coverUrl && (
                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                  <img src={newBook.coverUrl} alt="" style={{ height: 100, borderRadius: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
                </div>
              )}
              <button className="btn" style={{ width: '100%', background: '#1d1d1f', color: '#fff', marginTop: '0.5rem' }} onClick={saveNewBook}>
                Fichar Livro no Acervo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* My bookshelf */}
      <div className="card">
        <h3 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>📖 Suas Leituras</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {books.length === 0
            ? <p className="text-muted" style={{ textAlign: 'center', gridColumn: '1 / -1' }}>Estante vazia. Adicione livros acima.</p>
            : books.map((b, idx) => {
              const meta = catalog[b.bookId] || { title: b.title, totalPages: b.totalPages, coverUrl: b.coverUrl }
              const pct = b.percentage || 0
              return (
                <div key={b.bookId || idx} className="card" onClick={() => { setModalIdx(idx); setFeedback(null) }}
                  style={{ display: 'flex', gap: '1rem', alignItems: 'center', cursor: 'pointer', padding: '1rem' }}>
                  {(meta.coverUrl || b.coverUrl)
                    ? <img src={meta.coverUrl || b.coverUrl} alt="" style={{ width: 50, height: 75, objectFit: 'cover', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                    : <div style={{ width: 50, height: 75, background: '#f5f5f7', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📘</div>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '2px' }}>{meta.title || b.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#86868b', marginBottom: '6px' }}>Pág. {b.pagesRead || 0} de {meta.totalPages || b.totalPages || '?'}</div>
                    <div style={{ width: '100%', height: 5, background: '#e5e5ea', borderRadius: 3, overflow: 'hidden', marginBottom: '3px' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: b.status === 'completed' ? '#30d158' : '#1d1d1f', transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                      <span style={{ color: b.status === 'completed' ? '#30d158' : '#1d1d1f' }}>{pct.toFixed(1)}% Lido</span>
                      <span className="text-muted">{b.status === 'completed' ? 'Finalizado!' : `${(100 - pct).toFixed(1)}% Falta`}</span>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* ── MODAL ── */}
      {modalBook && modalMeta && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => e.target === e.currentTarget && setModalIdx(null)}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setModalIdx(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.3rem', marginBottom: '0.2rem', paddingRight: '2rem' }}>{modalMeta.title}</h2>
            <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
              Último avanço: Pág. {modalBook.pagesRead || 0} ({(modalBook.percentage || 0).toFixed(1)}%)
            </p>

            {/* Feedback */}
            {feedback && (
              <div style={{ background: '#f5f5f7', borderLeft: '4px solid #1d1d1f', padding: '1rem', borderRadius: '0 10px 10px 0', marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.2rem' }}>Salvo! +{feedback.increment} páginas</h4>
                <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                  Você esmagou <strong>{feedback.pct.toFixed(1)}%</strong> do título.
                  {feedback.isComplete && (
                    <div style={{ color: '#30d158', fontWeight: 700, marginTop: '0.5rem', fontSize: '1rem' }}>
                      🏆 LIVRO 100% CONCLUÍDO! Parabéns!
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Register progress */}
            {modalBook.status !== 'completed' ? (
              <div style={{ background: '#f5f5f7', padding: '1.2rem', borderRadius: '12px', border: '1px solid #e5e5ea', marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Novo Registro (Página Alcançada)</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input type="number" className="form-control" placeholder={`Ex: ${(modalBook.pagesRead || 0) + 15}`}
                    style={{ fontSize: '1.2rem' }} value={pageInput}
                    onChange={e => setPageInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && registerProgress()} />
                  <button className="btn" style={{ background: '#1d1d1f', color: '#fff', whiteSpace: 'nowrap' }} onClick={registerProgress}>Salvar</button>
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(48,209,88,0.1)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', textAlign: 'center', color: '#30d158', fontWeight: 600 }}>
                🎉 Livro 100% Concluído em {modalBook.completedDate}
              </div>
            )}

            {/* History Chart */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: '2rem' }}>
               <h4 style={{ fontSize: '0.95rem', margin: 0 }}>Histórico de Leitura</h4>
               <div style={{ display: 'flex', gap: '2px', background: '#f5f5f7', padding: '3px', borderRadius: '8px', border: '1px solid #e5e5ea' }}>
                  {[['7d', '7D'], ['30d', '30D'], ['year', 'Ano']].map(([v, l]) => (
                    <button key={v} onClick={() => { setModalFilter(v); setShowModalCustom(false) }} style={{
                      padding: '3px 8px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700,
                      background: modalFilter === v ? '#1d1d1f' : 'transparent', color: modalFilter === v ? '#fff' : '#86868b'
                    }}>{l}</button>
                  ))}
               </div>
            </div>

            <HistoryChart history={modalBook.history || []} filter={modalFilter} />

            {/* Social chart placeholder */}
            <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', marginTop: '1.5rem' }}>Termômetro Social</h4>
            <p className="text-muted" style={{ fontSize: '0.78rem', marginBottom: '1rem' }}>Seu avanço comparado com outros leitores.</p>
            <SocialChart bookId={modalBook.bookId} myPct={modalBook.percentage || 0} />

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button className="btn btn-secondary" style={{ color: '#ff3b30', border: 'none', fontSize: '0.8rem' }} onClick={() => removeBook(modalBook.bookId)}>
                <Trash2 size={13} /> Remover da Estante
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  )
}

// ── History Chart Component ──────────────────────────────────────────────────
function HistoryChart({ history, filter }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  const chartData = useMemo(() => {
    const now = new Date()
    let startDate
    if (filter === '7d') startDate = subDays(now, 6)
    else if (filter === '30d') startDate = subDays(now, 29)
    else if (filter === 'year') startDate = subYears(now, 1)
    else startDate = subDays(now, 29)

    const labels = []
    const values = []
    let curr = startOfDay(startDate)
    const end = endOfDay(now)

    while (curr <= end) {
      const dKey = format(curr, 'yyyy-MM-dd')
      labels.push(format(curr, 'dd/MM'))
      const entries = history.filter(h => h.date === dKey)
      const total = entries.reduce((s, e) => s + (e.increment || 0), 0)
      values.push(total)
      curr.setDate(curr.getDate() + 1)
    }
    return { labels, values }
  }, [history, filter])

  useEffect(() => {
    if (!canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: [{ label: 'Páginas', data: chartData.values, backgroundColor: '#007aff', borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
      }
    })
    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [chartData])

  return <div style={{ height: '140px' }}><canvas ref={canvasRef} /></div>
}

// ── Social Chart Component ───────────────────────────────────────────────────
function SocialChart({ bookId, myPct }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    if (chartRef.current) chartRef.current.destroy()

    const labels = ['Você (Eu)']
    const data = [myPct]
    const colors = ['#1d1d1f']

    // Scan other users in usersDB for same book
    try {
      const db = JSON.parse(localStorage.getItem('hub_users_db') || '{}')
      let counter = 1
      Object.values(db).forEach(u => {
        const otherBooks = u.appData?.booksBuffer || []
        const found = otherBooks.find(b => b.bookId === bookId)
        if (found) {
          labels.push(`Leitor ${counter++}`)
          data.push(found.percentage || 0)
          colors.push('rgba(0,0,0,0.15)')
        }
      })
    } catch {}

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets: [{ label: '% Lido', data, backgroundColor: colors, borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        scales: { x: { max: 100, beginAtZero: true }, y: { grid: { display: false } } },
        plugins: { legend: { display: false } }
      }
    })

    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [bookId, myPct])

  return <div style={{ height: '160px' }}><canvas ref={canvasRef} /></div>
}
