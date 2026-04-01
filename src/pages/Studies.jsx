import React, { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAppContext } from '../context/AppContext'
import {
  Plus, Trash2, ChevronRight, ChevronDown, Check,
  UploadCloud, Search, ArrowLeft, Download, ExternalLink
} from 'lucide-react'

// ─── helpers ────────────────────────────────────────────────────────────────
const uid = () => Date.now().toString() + Math.random().toString(36).substr(2, 5)
const createNode = (name) => ({ id: uid(), name, completed: false, collapsed: false, children: [] })

function getTrackProgress(node) {
  let total = 0, done = 0
  function walk(n) {
    if (n.children.length === 0) { total++; if (n.completed) done++ }
    else n.children.forEach(walk)
  }
  walk(node)
  return total === 0 ? 0 : ((done / total) * 100)
}

// Deep-clone tree removing completion status (for publishing)
function cleanTree(nodes) {
  return JSON.parse(JSON.stringify(nodes)).map(function strip(n) {
    n.completed = false
    if (n.children) n.children = n.children.map(strip)
    return n
  })
}

// ─── recursive tree operations ───────────────────────────────────────────────
function findAndDo(nodes, id, fn) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) { fn(nodes, i); return true }
    if (nodes[i].children?.length && findAndDo(nodes[i].children, id, fn)) return true
  }
  return false
}

// ─── component ───────────────────────────────────────────────────────────────
export default function Studies() {
  const { appData, updateAppData } = useAppContext()
  const [tab, setTab] = useState('local')       // 'local' | 'global'
  const [viewMode, setViewMode] = useState('list') // 'list' | 'mindmap'
  const [newTrackName, setNewTrackName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState(null) // null = not searched
  const [selectedGlobal, setSelectedGlobal] = useState(null)
  const [newGlobal, setNewGlobal] = useState({ title: '', professor: '', category: '', linkUrl: '' })

  // Simulated global catalog (localStorage)
  const [globalDB, setGlobalDB] = useState(() => {
    const s = localStorage.getItem('hub_studies_db')
    return s ? JSON.parse(s) : {}
  })

  useEffect(() => {
    localStorage.setItem('hub_studies_db', JSON.stringify(globalDB))
  }, [globalDB])

  if (!appData) return <div style={{ padding: '2rem', textAlign: 'center', color: '#86868b' }}>Carregando...</div>

  const tracks = appData.studiesBuffer || []

  // ── Local Actions ─────────────────────────────────────────────────────────
  const mutate = (fn) => {
    const clone = JSON.parse(JSON.stringify(tracks))
    fn(clone)
    updateAppData(prev => ({ ...prev, studiesBuffer: clone }))
  }

  const addTrack = () => {
    if (!newTrackName.trim()) return
    const node = createNode(newTrackName.trim())
    mutate(arr => arr.push(node))
    // Also publish to global catalog as empty
    setGlobalDB(prev => ({
      ...prev,
      [node.id]: { id: node.id, title: node.name, professor: 'Eu mesmo', category: 'Outros', treeData: null, addedBy: 'me' }
    }))
    setNewTrackName('')
  }

  const addSubNode = (parentId) => {
    const name = window.prompt('Nome da seção/aula/capítulo:')
    if (!name) return
    mutate(arr => findAndDo(arr, parentId, (nodes, i) => {
      nodes[i].children.push(createNode(name))
      nodes[i].collapsed = false
    }))
  }

  const toggleComplete = (nodeId) => {
    mutate(arr => findAndDo(arr, nodeId, (nodes, i) => { nodes[i].completed = !nodes[i].completed }))
  }

  const toggleCollapse = (nodeId) => {
    mutate(arr => findAndDo(arr, nodeId, (nodes, i) => { nodes[i].collapsed = !nodes[i].collapsed }))
  }

  const removeNode = (nodeId) => {
    if (!confirm('Remover este item e todos os seus subitens?')) return
    mutate(arr => {
      const rootIdx = arr.findIndex(t => t.id === nodeId)
      if (rootIdx > -1) { arr.splice(rootIdx, 1); return }
      findAndDo(arr, nodeId, (nodes, i) => nodes.splice(i, 1))
    })
  }

  // ── Global Actions ────────────────────────────────────────────────────────
  const doSearch = () => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) { setSearchResults(null); return }
    const results = Object.values(globalDB).filter(s =>
      `${s.title} ${s.professor} ${s.category}`.toLowerCase().includes(q)
    )
    setSearchResults(results)
    setSelectedGlobal(null)
  }

  const saveNewGlobalStudy = () => {
    if (!newGlobal.title.trim()) return alert('Nome do curso é obrigatório.')
    const id = uid()
    setGlobalDB(prev => ({
      ...prev,
      [id]: { id, title: newGlobal.title, professor: newGlobal.professor, category: newGlobal.category, linkUrl: newGlobal.linkUrl, treeData: null, addedBy: 'me' }
    }))
    if (confirm('Curso publicado! Deseja importar para seu mapeamento local?')) {
      importTrack(id, newGlobal.title, null)
    }
    setNewGlobal({ title: '', professor: '', category: '', linkUrl: '' })
    setTab('local')
  }

  const importTrack = (globalId, title, treeData) => {
    const node = createNode(title || 'Trilha Importada')
    node.linkedGlobalId = globalId
    if (treeData) node.children = JSON.parse(JSON.stringify(treeData))
    mutate(arr => arr.push(node))
    alert('Trilha importada com sucesso!')
    setTab('local')
  }

  const publishToGlobal = (trackId) => {
    const track = tracks.find(t => t.id === trackId)
    if (!track) return
    if (!track.linkedGlobalId) return alert('Essa trilha foi criada localmente. Apenas trilhas importadas do acervo podem ser publicadas.')
    if (!confirm('Sobrescrever a estrutura pública dessa trilha com a sua árvore atual?')) return
    setGlobalDB(prev => ({
      ...prev,
      [track.linkedGlobalId]: { ...prev[track.linkedGlobalId], treeData: cleanTree(track.children) }
    }))
    alert('Publicação na nuvem efetuada! Outros alunos poderão importar sua estrutura.')
  }

  // ── Render: Tree List ─────────────────────────────────────────────────────
  const TreeNode = ({ node, depth = 0 }) => {
    const isRoot = depth === 0
    const hasChildren = (node.children || []).length > 0
    const isLeaf = !hasChildren && !isRoot
    const progress = isRoot ? getTrackProgress(node) : 0

    return (
      <div style={{ paddingLeft: isRoot ? 0 : 16 + depth * 8, marginTop: isRoot ? 0 : '0.4rem' }}>
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem',
          background: isRoot ? '#f5f5f7' : 'transparent',
          padding: isRoot ? '0.8rem 1rem' : '0.3rem 0.5rem',
          borderRadius: isRoot ? '10px' : '0',
          border: isRoot ? '1px solid #e5e5ea' : 'none'
        }}>
          {/* Collapse/Expand */}
          {hasChildren
            ? <button onClick={() => toggleCollapse(node.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86868b', padding: '2px' }}>
                {node.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </button>
            : <div style={{ width: 20 }} />}

          {/* Checkbox for leaf nodes */}
          {isLeaf && (
            <div onClick={() => toggleComplete(node.id)} style={{
              width: 20, height: 20, borderRadius: '5px',
              border: `2px solid ${node.completed ? '#30d158' : '#d2d2d7'}`,
              background: node.completed ? '#30d158' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0
            }}>
              {node.completed && <Check size={12} color="#fff" />}
            </div>
          )}

          {/* Name */}
          <div style={{
            flex: 1, minWidth: 120,
            fontWeight: isRoot ? 600 : (hasChildren ? 500 : 400),
            fontSize: isRoot ? '1.05rem' : '0.92rem',
            textDecoration: node.completed && isLeaf ? 'line-through' : 'none',
            color: node.completed && isLeaf ? '#86868b' : '#1d1d1f'
          }}>
            {node.name || node.title}
            {isRoot && <span style={{ marginLeft: '0.8rem', color: '#86868b', fontSize: '0.85rem' }}>{progress.toFixed(1)}%</span>}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            {isRoot && (
              <button onClick={() => publishToGlobal(node.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007aff', padding: '2px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem' }}>
                <UploadCloud size={13} /> Publicar
              </button>
            )}
            <button onClick={() => addSubNode(node.id)} style={{ background: '#f5f5f7', border: '1px solid #e5e5ea', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: '#1d1d1f' }}>
              + Filial
            </button>
            <button onClick={() => removeNode(node.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff3b30', padding: '2px' }}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && !node.collapsed && (
          <div style={{ borderLeft: '1px solid #e5e5ea', marginLeft: isRoot ? '1.2rem' : 12 + depth * 4, marginTop: '0.3rem' }}>
            {node.children.map(child => <TreeNode key={child.id} node={child} depth={depth + 1} />)}
          </div>
        )}
      </div>
    )
  }

  // ── Render: Mind Map ──────────────────────────────────────────────────────
  const MindMapNode = ({ node, depth = 0 }) => {
    const isRoot = depth === 0
    const hasChildren = (node.children || []).length > 0
    const isLeaf = !hasChildren
    const bg = isRoot ? '#1d1d1f' : (isLeaf && node.completed ? '#30d158' : '#f5f5f7')
    const color = isRoot || (isLeaf && node.completed) ? '#fff' : '#1d1d1f'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div onClick={() => hasChildren ? toggleCollapse(node.id) : (isLeaf && !isRoot ? toggleComplete(node.id) : null)}
          style={{
            background: bg, color, padding: '0.6rem 1.2rem', borderRadius: '10px', cursor: 'pointer',
            fontSize: isRoot ? '0.95rem' : '0.82rem', fontWeight: isRoot ? 700 : 500, textAlign: 'center',
            border: `1px solid ${isRoot ? '#1d1d1f' : '#e5e5ea'}`, minWidth: '80px', maxWidth: '200px'
          }}>
          {node.name || node.title}
          {isRoot && <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: '2px' }}>{getTrackProgress(node).toFixed(1)}% finalizado</div>}
          {hasChildren && <div style={{ fontSize: '0.68rem', opacity: 0.5, marginTop: '2px' }}>{node.collapsed ? '▶ Expandir' : '▼'}</div>}
        </div>
        {hasChildren && !node.collapsed && (
          <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.8rem', flexWrap: 'wrap', justifyContent: 'center', paddingLeft: '1rem', borderLeft: '2px solid #e5e5ea' }}>
            {node.children.map(child => <MindMapNode key={child.id} node={child} depth={depth + 1} />)}
          </div>
        )}
      </div>
    )
  }

  // ── Global featured carousel (5 random) ───────────────────────────────────
  const globalList = Object.values(globalDB)
  const featured = globalList.sort(() => 0.5 - Math.random()).slice(0, 5)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Layout title="Trilhas de Estudos" subtitle="Estruture seu aprendizado, pesquise cursos e importe mapas mentais.">

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[['local', '📓 Mapeamento Local (Meu Caderno)'], ['global', '🌐 Acervo Comunitário & Busca']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '0.5rem 1.2rem', border: 'none', borderRadius: '999px', cursor: 'pointer',
            background: tab === key ? (key === 'global' ? '#007aff' : '#1d1d1f') : '#f5f5f7',
            color: tab === key ? '#fff' : '#1d1d1f', fontWeight: 600, fontSize: '0.85rem'
          }}>{label}</button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* LOCAL TAB */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {tab === 'local' && (
        <>
          {/* Sub-tabs: List vs Mind Map */}
          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1.5rem' }}>
            {[['list', 'Visão em Lista'], ['mindmap', 'Visão Mapa Mental']].map(([m, l]) => (
              <button key={m} onClick={() => setViewMode(m)} style={{
                padding: '0.35rem 1rem', border: `1px solid ${viewMode === m ? '#1d1d1f' : '#e5e5ea'}`,
                borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
                background: viewMode === m ? '#1d1d1f' : 'transparent', color: viewMode === m ? '#fff' : '#86868b'
              }}>{l}</button>
            ))}
          </div>

          {/* Create track form (only in list mode) */}
          {viewMode === 'list' && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Criar Trilha Manualmente (Privada)</label>
                  <input className="form-control" placeholder="Ex: Formação Fullstack JavaScript"
                    value={newTrackName} onChange={e => setNewTrackName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTrack()} />
                </div>
                <button className="btn" style={{ background: '#1d1d1f', color: '#fff', height: '42px' }} onClick={addTrack}>
                  <Plus size={15} style={{ marginRight: '4px' }} /> Nova Trilha
                </button>
              </div>
            </div>
          )}

          {/* Tracks display */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowX: 'auto' }}>
            {tracks.length === 0
              ? <p style={{ color: '#86868b', textAlign: 'center', padding: '2rem', border: '1px dashed #d2d2d7', borderRadius: '12px' }}>
                  Nenhuma trilha mapeada. Busque no Acervo Global ou crie sua trilha manualmente.
                </p>
              : viewMode === 'list'
                ? tracks.map(t => <TreeNode key={t.id} node={t} depth={0} />)
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', alignItems: 'center', padding: '1rem' }}>
                    {tracks.map(t => <MindMapNode key={t.id} node={t} depth={0} />)}
                  </div>
                )
            }
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* GLOBAL TAB */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {tab === 'global' && (
        <>
          {/* Featured carousel */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.78rem', color: '#86868b', textTransform: 'uppercase', marginBottom: '0.8rem', letterSpacing: '0.05rem' }}>🧠 Trilhas em Destaque</h4>
            <div style={{ display: 'flex', overflowX: 'auto', gap: '0.8rem', paddingBottom: '0.5rem' }}>
              {featured.length === 0
                ? <span style={{ color: '#86868b', fontSize: '0.8rem' }}>Acervo vazio.</span>
                : featured.map(s => (
                  <div key={s.id} onClick={() => setSelectedGlobal(s)} style={{
                    minWidth: '180px', maxWidth: '180px', background: '#f5f5f7', borderLeft: '3px solid #007aff',
                    padding: '0.8rem 1rem', borderRadius: '10px', cursor: 'pointer', border: '1px solid #e5e5ea',
                    transition: 'transform 0.15s', flexShrink: 0
                  }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                    <div style={{ fontSize: '0.72rem', color: '#86868b', marginTop: '2px' }}>Prof: {s.professor || 'N/A'}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* Search engine */}
          <div className="card" style={{ borderLeft: '4px solid #007aff', marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem', color: '#007aff', fontSize: '1.1rem' }}>Motor de Busca Global</h3>
            <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '1.2rem' }}>
              Pesquise cursos, faculdades ou professores. Importe árvores prontas mapeadas por outros alunos.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input className="form-control" placeholder="Ex: React, Python, Guanabara..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()} />
              <button className="btn" style={{ background: '#007aff', color: '#fff' }} onClick={doSearch}>
                <Search size={16} />
              </button>
            </div>

            {/* Search results */}
            {searchResults !== null && (
              <div style={{ marginTop: '1.5rem' }}>
                {selectedGlobal ? (
                  <>
                    <button onClick={() => setSelectedGlobal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007aff', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                      <ArrowLeft size={14} /> Voltar à Pesquisa
                    </button>
                    <GlobalStudyDetail study={selectedGlobal} onImport={(id, title, tree) => importTrack(id, title, tree)} />
                  </>
                ) : searchResults.length > 0 ? (
                  <>
                    <div style={{ fontWeight: 600, marginBottom: '1rem', fontSize: '0.9rem' }}>🔍 {searchResults.length} resultado(s):</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      {searchResults.map(s => (
                        <div key={s.id} onClick={() => setSelectedGlobal(s)} style={{
                          borderLeft: '4px solid #007aff', border: '1px solid rgba(0,122,255,0.3)', borderRadius: '10px',
                          padding: '1rem', cursor: 'pointer', background: 'rgba(0,122,255,0.03)'
                        }}>
                          <h4 style={{ marginBottom: '0.2rem', color: '#007aff', fontSize: '1rem' }}>{s.title}</h4>
                          <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                            👨‍🏫 Prof: <strong>{s.professor || 'N/A'}</strong> | Cat: {s.category || 'Mista'}
                          </p>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#007aff', color: '#fff', padding: '3px 10px', borderRadius: '12px' }}>Visualizar Trilha</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  /* Not found → create new */
                  <div style={{ background: '#f5f5f7', padding: '1.5rem', borderRadius: '12px', border: '1px dashed #007aff' }}>
                    <p className="text-muted" style={{ marginBottom: '1rem' }}>
                      Nenhum curso contendo <strong>"{searchTerm}"</strong> foi encontrado.
                    </p>
                    <h4 style={{ color: '#007aff', marginBottom: '1rem' }}>+ Inserir Novo Curso</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input className="form-control" placeholder="Nome do Curso *"
                        value={newGlobal.title} onChange={e => setNewGlobal({ ...newGlobal, title: e.target.value })} />
                      <input className="form-control" placeholder="Professor (Ex: Guanabara)"
                        value={newGlobal.professor} onChange={e => setNewGlobal({ ...newGlobal, professor: e.target.value })} />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input className="form-control" placeholder="Categoria (Ex: Code, Inglês)"
                          value={newGlobal.category} onChange={e => setNewGlobal({ ...newGlobal, category: e.target.value })} />
                        <input className="form-control" placeholder="Link (URL YouTube etc)"
                          value={newGlobal.linkUrl} onChange={e => setNewGlobal({ ...newGlobal, linkUrl: e.target.value })} />
                      </div>
                      <button className="btn" style={{ width: '100%', background: '#007aff', color: '#fff', marginTop: '0.5rem' }} onClick={saveNewGlobalStudy}>
                        Disponibilizar no Acervo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  )
}

// ─── Global Study Detail View ────────────────────────────────────────────────
function GlobalStudyDetail({ study, onImport }) {
  const hasTree = !!study.treeData
  return (
    <div style={{ background: '#f5f5f7', padding: '1.5rem', borderRadius: '12px', border: '1px solid #007aff', borderLeft: '4px solid #007aff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h4 style={{ fontSize: '1.2rem', color: '#007aff' }}>{study.title}</h4>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {study.linkUrl && (
            <a href={study.linkUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,122,255,0.1)', color: '#007aff', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 500 }}>
              <ExternalLink size={13} /> Portal
            </a>
          )}
        </div>
      </div>
      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        👨‍🏫 Prof: {study.professor || 'N/A'} | Categoria: {study.category || 'Mista'}
      </p>
      <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
        <strong>Condição Atual da Trilha:</strong><br />
        {hasTree
          ? '✅ Mapa Mental Estruturado Disponível (Importação Total Pronta)'
          : '⛔ Nenhum aluno estruturou árvore ainda. Você pode importar vazia e contribuir!'
        }
      </div>
      <button className="btn" style={{ width: '100%', background: '#007aff', color: '#fff', padding: '0.8rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        onClick={() => onImport(study.id, study.title, study.treeData)}>
        <Download size={18} /> Importar Trilha para Minha Base
      </button>
    </div>
  )
}
