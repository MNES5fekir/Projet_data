import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const chartColors = ['#236c59', '#d27a4b', '#5c7eae', '#b49942', '#8a6e9e', '#488277', '#b86162', '#708f4a']
const sectionTargets = [
  ['upload-section', 'upload'],
  ['analysis-results', 'results'],
  ['distribution-section', 'distribution'],
  ['categories-section', 'categories'],
  ['correlations-section', 'correlations'],
  ['scatter-section', 'scatter'],
  ['statistics-section', 'statistics'],
  ['quality-section', 'quality'],
]

async function sendAnalyticsEvent(event, section) {
  try {
    await fetch(`${API_URL}/analytics/events`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, section }),
    })
  } catch {
    // Analytics must never block the CSV analysis.
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function displayFilename(filename) {
  return filename.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_/i, '')
}

async function analyzeFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${API_URL}/analysis`, { method: 'POST', credentials: 'include', body: formData })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.detail || 'Le fichier n’a pas pu être analysé.')
  return payload
}

function reportHtml(result) {
  const { analysis } = result
  const filename = displayFilename(result.filename)
  const overview = analysis.overview
  const correlations = analysis.correlations.map(({ column, other_column, value }) => `
    <tr><td>${escapeHtml(column)}</td><td>${escapeHtml(other_column)}</td><td>${value.toFixed(3)}</td><td>${correlationLabel(value)}</td></tr>`).join('')
  const columns = analysis.columns.map((column) => `
    <tr><td>${escapeHtml(column.name)}</td><td>${escapeHtml(column.type)}</td><td>${column.unique_values}</td><td>${column.missing_values}</td><td>${column.missing_percentage}%</td></tr>`).join('')
  const statistics = Object.entries(analysis.statistics).map(([name, stats]) => `
    <tr><td>${escapeHtml(name)}</td><td>${formatNumber(stats.mean)}</td><td>${formatNumber(stats.median)}</td><td>${formatNumber(stats.min)}</td><td>${formatNumber(stats.max)}</td><td>${formatNumber(stats.std)}</td></tr>`).join('')
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Rapport - ${escapeHtml(filename)}</title><style>
    body{max-width:980px;margin:40px auto;padding:0 24px;color:#26332d;font:15px/1.55 Arial,sans-serif}header{padding-bottom:22px;border-bottom:3px solid #236c59}h1{font-size:30px}h2{margin-top:34px;font-size:19px}p,.muted{color:#748077}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:24px 0}.metric{padding:15px;border:1px solid #e0e6df}.metric small{display:block;color:#78847b}.metric strong{display:block;margin-top:7px;font-size:24px}table{width:100%;border-collapse:collapse;margin:12px 0 26px;font-size:13px}th,td{padding:10px;border-bottom:1px solid #e8ece7;text-align:left}th{background:#f3f6f1}footer{margin-top:36px;padding-top:12px;border-top:1px solid #e0e6df;color:#748077;font-size:12px}@media(max-width:650px){.metrics{grid-template-columns:repeat(2,1fr)}body{margin:20px auto}}
  </style><body><header><p>DATACLAIR · RAPPORT D’ANALYSE</p><h1>${escapeHtml(filename)}</h1><p>Rapport généré le ${new Date().toLocaleDateString('fr-FR')}</p></header><section class="metrics"><div class="metric"><small>Lignes</small><strong>${overview.rows.toLocaleString('fr-FR')}</strong></div><div class="metric"><small>Colonnes</small><strong>${overview.columns}</strong></div><div class="metric"><small>Valeurs manquantes</small><strong>${overview.missing_values}</strong></div><div class="metric"><small>Doublons</small><strong>${overview.duplicates}</strong></div></section><h2>Corrélations numériques</h2><p class="muted">Corrélation de Pearson : relation linéaire comprise entre -1 et 1. Une corrélation n’implique pas une causalité.</p><table><thead><tr><th>Variable A</th><th>Variable B</th><th>Coefficient</th><th>Lecture</th></tr></thead><tbody>${correlations || '<tr><td colspan="4">Aucune paire numérique exploitable.</td></tr>'}</tbody></table><h2>Statistiques numériques</h2><table><thead><tr><th>Colonne</th><th>Moyenne</th><th>Médiane</th><th>Min</th><th>Max</th><th>Écart-type</th></tr></thead><tbody>${statistics || '<tr><td colspan="6">Aucune colonne numérique.</td></tr>'}</tbody></table><h2>Qualité des colonnes</h2><table><thead><tr><th>Colonne</th><th>Type</th><th>Valeurs uniques</th><th>Manquantes</th><th>% manquant</th></tr></thead><tbody>${columns}</tbody></table><footer>Généré par DataClair · L’analyse est calculée à partir du fichier importé.</footer></body></html>`
}

function formatNumber(value) {
  return Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

function correlationLabel(value) {
  const strength = Math.abs(value) >= 0.7 ? 'Forte' : Math.abs(value) >= 0.4 ? 'Modérée' : Math.abs(value) >= 0.2 ? 'Faible' : 'Très faible'
  return `${strength} ${value < 0 ? 'négative' : 'positive'}`
}

function AnalyzerApp() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [activeColumn, setActiveColumn] = useState('')
  const [consent, setConsent] = useState('loading')
  const fileInput = useRef(null)
  const seenSections = useRef(new Set())
  const pageViewRecorded = useRef(false)
  const hasResult = Boolean(result)
  const histogram = useMemo(
    () => result?.charts.histograms.find((item) => item.column === activeColumn) || result?.charts.histograms[0],
    [result, activeColumn],
  )

  function trackEvent(event, section) {
    if (consent === 'accepted') sendAnalyticsEvent(event, section)
  }

  useEffect(() => {
    fetch(`${API_URL}/analytics/consent`, { credentials: 'include' })
      .then((response) => response.json())
      .then((value) => setConsent(value.choice))
      .catch(() => setConsent('unavailable'))
  }, [])

  useEffect(() => {
    if (consent !== 'accepted' || pageViewRecorded.current) return
    pageViewRecorded.current = true
    sendAnalyticsEvent('page_view', 'home')
  }, [consent])

  useEffect(() => {
    if (consent !== 'accepted') return undefined
    const observed = sectionTargets
      .map(([id, section]) => ({ node: document.getElementById(id), section }))
      .filter((item) => item.node)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const section = observed.find((item) => item.node === entry.target)?.section
        if (!section || seenSections.current.has(section)) return
        seenSections.current.add(section)
        sendAnalyticsEvent('section_view', section)
      })
    }, { threshold: 0.35 })
    observed.forEach(({ node }) => observer.observe(node))
    return () => observer.disconnect()
  }, [consent, hasResult])

  async function chooseAnalyticsConsent(accepted) {
    try {
      const response = await fetch(`${API_URL}/analytics/consent`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted }),
      })
      if (!response.ok) throw new Error('Consentement indisponible')
      seenSections.current.clear()
      setConsent(accepted ? 'accepted' : 'rejected')
    } catch {
      setConsent('unavailable')
    }
  }

  function selectFile(selectedFile) {
    if (!selectedFile) return
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Choisissez un fichier au format CSV.')
      return
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('Le fichier dépasse la limite de 10 Mo.')
      return
    }
    setFile(selectedFile)
    setError('')
    setResult(null)
    trackEvent('file_selected', 'upload')
  }

  async function submitFile(event) {
    event.preventDefault()
    if (!file || loading) return
    setLoading(true)
    setError('')
    trackEvent('analysis_started', 'upload')
    try {
      const analysis = await analyzeFile(file)
      setResult(analysis)
      seenSections.current.clear()
      trackEvent('analysis_succeeded', 'results')
      setActiveColumn(analysis.charts.histograms[0]?.column || '')
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      requestAnimationFrame(() => document.getElementById('analysis-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (uploadError) {
      setError(uploadError.message)
      trackEvent('analysis_failed', 'upload')
    } finally {
      setLoading(false)
    }
  }

  function downloadReport() {
    if (!result) return
    trackEvent('report_downloaded', 'results')
    const content = reportHtml(result)
    const url = URL.createObjectURL(new Blob([content], { type: 'text/html;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${displayFilename(result.filename).replace(/\.csv$/i, '')}-rapport.html`
    link.click()
    URL.revokeObjectURL(url)
  }

  const overview = result?.analysis.overview
  const scatter = result?.charts.scatter.find((pair) => pair.x_column !== pair.y_column)

  return (
    <>
    <div className="site-shell">
      <header className="site-header">
        <a className="wordmark" href="#accueil" aria-label="DataClair, accueil"><span className="logo-icon">d</span>dataclair<span className="wordmark-period">.</span></a>
        <nav><a href="#outil">L’outil</a><a href="#comment-ca-marche">Comment ça marche</a></nav>
        <span className="header-note"><i /> Gratuit · sans inscription</span>
      </header>

      <main id="accueil">
        <section className="intro" id="outil">
          <div className="intro-copy"><p className="eyebrow">ANALYSE DE FICHIERS CSV</p><h1>Vos données ont<br />beaucoup à <em>dire.</em></h1><p className="intro-description">Importez un fichier. Découvrez ses tendances, ses liens et ses points à surveiller en un instant.</p></div>
          <div className="intro-aside" aria-hidden="true"><div className="aside-top"><span>APERÇU DES DONNÉES</span><span>01 — 08</span></div><div className="mini-chart"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="aside-bottom"><span>Une lecture claire, sans détour.</span><span>CSV / 10 MB</span></div></div>
        </section>

        <form id="upload-section" className={`upload-surface ${dragging ? 'is-dragging' : ''}`} onSubmit={submitFile} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]) }}>
          <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={(event) => selectFile(event.target.files[0])} aria-label="Choisir un fichier CSV" />
          <span className="upload-symbol" aria-hidden="true">↑</span>
          <div className="upload-copy"><strong>{file ? displayFilename(file.name) : 'Déposez votre fichier CSV ici'}</strong><span>{file ? `${(file.size / 1024).toFixed(0)} Ko · prêt à analyser` : 'ou sélectionnez-le depuis votre appareil'}</span></div>
          <button type="button" className="browse-button" onClick={() => fileInput.current?.click()}>{file ? 'Changer de fichier' : 'Choisir un fichier'}</button>
          <button className="analyze-button" type="submit" disabled={!file || loading}>{loading ? <><span className="button-spinner" /> Analyse…</> : <>Analyser le fichier <span aria-hidden="true">↗</span></>}</button>
          <span className="upload-limit">CSV uniquement · 10 Mo maximum · Fichier non conservé</span>
        </form>
        {error && <p className="error-message" role="alert">{error}</p>}

        {!result && <section className="how-strip" id="comment-ca-marche"><div><span>01</span><p><strong>Importez</strong> votre fichier CSV.</p></div><div><span>02</span><p><strong>Explorez</strong> les statistiques et graphiques.</p></div><div><span>03</span><p><strong>Exportez</strong> un rapport prêt à partager.</p></div></section>}

        {result && <AnalysisDashboard result={result} overview={overview} histogram={histogram} activeColumn={activeColumn} setActiveColumn={setActiveColumn} scatter={scatter} onDownload={downloadReport} />}
      </main>
      <footer className="site-footer"><span>DATACLAIR · ANALYSE LOCALE</span><span>Votre fichier est traité temporairement et n’est pas conservé.</span><button type="button" onClick={() => setConsent('unknown')}>Préférences cookies</button><a href="/admin/analytics">Statistiques du site</a></footer>
    </div>
    {consent === 'unknown' && <ConsentBanner onChoose={chooseAnalyticsConsent} />}
    </>
  )
}

function AnalysisDashboard({ result, overview, histogram, activeColumn, setActiveColumn, scatter, onDownload }) {
  const { analysis, charts } = result
  const filename = displayFilename(result.filename)
  const stats = analysis.statistics
  const categoryProfile = charts.categories.find((item) => item.values.some((value) => value > 1)) || charts.categories[0]
  return (
    <section className="results" id="analysis-results">
      <div className="results-heading"><div><p className="eyebrow">RAPPORT D’ANALYSE</p><h2>{filename}</h2><p>Profil généré à partir de {overview.rows.toLocaleString('fr-FR')} lignes.</p></div><button className="download-button" type="button" onClick={onDownload}><span aria-hidden="true">↓</span> Télécharger le rapport</button></div>

      <div className="metric-grid">
        <Metric label="LIGNES" value={overview.rows} tone="green" />
        <Metric label="COLONNES" value={overview.columns} tone="blue" />
        <Metric label="VALEURS MANQUANTES" value={overview.missing_values} tone="orange" />
        <Metric label="DOUBLONS" value={overview.duplicates} tone="red" />
      </div>

      <div className="visual-grid">
        <section className="report-panel distribution-panel" id="distribution-section">
          <PanelTitle eyebrow="DISTRIBUTION" title="Répartition des valeurs" />
          {charts.histograms.length ? <><label className="select-label" htmlFor="histogram-column">Colonne numérique</label><select id="histogram-column" value={activeColumn} onChange={(event) => setActiveColumn(event.target.value)}>{charts.histograms.map((item) => <option key={item.column} value={item.column}>{item.column}</option>)}</select><div className="chart-frame"><ResponsiveContainer width="100%" height="100%"><BarChart data={histogram.labels.map((label, index) => ({ label, count: histogram.values[index] }))} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e9ece7" strokeDasharray="3 5" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#7a857d', fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#7a857d', fontSize: 10 }} allowDecimals={false} /><Tooltip contentStyle={{ border: '1px solid #e2e7e1', borderRadius: 3, fontSize: 12 }} /><Bar dataKey="count" name="Nombre de valeurs" fill="#276f5b" radius={[2, 2, 0, 0]} maxBarSize={42} /></BarChart></ResponsiveContainer></div><p className="chart-caption">Moyenne <strong>{formatNumber(histogram.mean)}</strong><span /> Médiane <strong>{formatNumber(histogram.median)}</strong></p></> : <EmptyPanel text="Aucune colonne numérique à représenter." />}
        </section>

        <section className="report-panel category-panel" id="categories-section"><PanelTitle eyebrow="PROFIL CATÉGORIEL" title="Valeurs les plus fréquentes" />{categoryProfile ? <div className="category-list">{categoryProfile.labels.map((label, index) => { const max = Math.max(...categoryProfile.values, 1); return <div className="category-row" key={label}><span className="category-label" title={label}>{label}</span><span className="category-track"><i style={{ width: `${categoryProfile.values[index] / max * 100}%`, background: chartColors[index % chartColors.length] }} /></span><strong>{categoryProfile.values[index]}</strong></div> })}<p className="chart-caption">Colonne <strong>{categoryProfile.column}</strong> · occurrences</p></div> : <EmptyPanel text="Aucune colonne catégorielle exploitable." />}</section>
      </div>

      <div className="visual-grid correlations-grid">
        <section className="report-panel correlation-panel" id="correlations-section"><PanelTitle eyebrow="RELATIONS ENTRE VARIABLES" title="Corrélations détaillées" /><p className="panel-description">Coefficient de Pearson · de −1 (inverse) à +1 (ensemble). Une corrélation ne prouve pas une causalité.</p>{analysis.correlations.length ? <div className="correlation-list">{analysis.correlations.map((pair) => <CorrelationRow key={`${pair.column}-${pair.other_column}`} pair={pair} />)}</div> : <EmptyPanel text="Il faut au moins deux colonnes numériques pour calculer une corrélation." />}</section>
        <section className="report-panel scatter-panel" id="scatter-section"><PanelTitle eyebrow="RELATION BIVARIÉE" title="Nuage de points" />{scatter ? <><p className="scatter-label">{scatter.x_column}<span> × </span>{scatter.y_column}</p><div className="scatter-frame"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 12, bottom: 0, left: -16 }}><CartesianGrid stroke="#e9ece7" strokeDasharray="3 5" /><XAxis type="number" dataKey="x" name={scatter.x_column} tick={{ fill: '#7a857d', fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis type="number" dataKey="y" name={scatter.y_column} tick={{ fill: '#7a857d', fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ strokeDasharray: '3 3' }} /><Scatter data={scatter.points} fill="#d27a4b" fillOpacity={0.72} /></ScatterChart></ResponsiveContainer></div></> : <EmptyPanel text="Ajoutez deux colonnes numériques pour explorer leur relation." />}</section>
      </div>

      <section className="report-panel stats-panel" id="statistics-section"><PanelTitle eyebrow="STATISTIQUES DESCRIPTIVES" title="Comprendre les colonnes numériques" /><div className="table-scroll"><table><thead><tr><th>Colonne</th><th>Moyenne</th><th>Médiane</th><th>Minimum</th><th>Maximum</th><th>Écart-type</th></tr></thead><tbody>{Object.entries(stats).map(([column, values]) => <tr key={column}><td>{column}</td><td>{formatNumber(values.mean)}</td><td>{formatNumber(values.median)}</td><td>{formatNumber(values.min)}</td><td>{formatNumber(values.max)}</td><td>{formatNumber(values.std)}</td></tr>)}</tbody></table>{!Object.keys(stats).length && <EmptyPanel text="Aucune statistique numérique disponible." />}</div></section>

      <section className="report-panel quality-panel" id="quality-section"><PanelTitle eyebrow="QUALITÉ DES DONNÉES" title="État de chaque colonne" /><div className="table-scroll"><table><thead><tr><th>Colonne</th><th>Type</th><th>Valeurs uniques</th><th>Manquantes</th><th>Part manquante</th><th>Valeurs atypiques</th></tr></thead><tbody>{analysis.columns.map((column) => { const outlier = analysis.outliers[column.name]; return <tr key={column.name}><td>{column.name}</td><td>{column.type}</td><td>{column.unique_values.toLocaleString('fr-FR')}</td><td>{column.missing_values.toLocaleString('fr-FR')}</td><td><span className={column.missing_percentage ? 'quality-warning' : 'quality-good'}>{column.missing_percentage}%</span></td><td>{outlier ? `${outlier.count} (${outlier.percentage}%)` : '—'}</td></tr> })}</tbody></table></div></section>
    </section>
  )
}

function CorrelationRow({ pair }) {
  const value = pair.value
  const strength = Math.abs(value) >= 0.7 ? 'Forte' : Math.abs(value) >= 0.4 ? 'Modérée' : Math.abs(value) >= 0.2 ? 'Faible' : 'Très faible'
  const direction = value < 0 ? 'négative' : 'positive'
  return <div className="correlation-row"><div className="relation-names"><strong>{pair.column}</strong><span>avec</span><strong>{pair.other_column}</strong></div><div className="relation-track"><i className={value < 0 ? 'negative' : 'positive'} style={{ width: `${Math.abs(value) * 100}%` }} /></div><div className="relation-result"><strong className={value < 0 ? 'negative-text' : 'positive-text'}>{value > 0 ? '+' : ''}{value.toFixed(3)}</strong><span>{strength} {direction}</span></div></div>
}

function Metric({ label, value, tone }) {
  return <article className={`metric-card metric-${tone}`}><span>{label}</span><strong>{Number(value).toLocaleString('fr-FR')}</strong></article>
}

function PanelTitle({ eyebrow, title }) {
  return <div className="panel-title"><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div>
}

function EmptyPanel({ text }) {
  return <div className="empty-panel"><span aria-hidden="true">—</span><p>{text}</p></div>
}

function ConsentBanner({ onChoose }) {
  return (
    <aside className="consent-banner" aria-label="Préférences de mesure d’audience">
      <div className="consent-copy"><strong>Mesure d’audience pseudonyme, avec votre accord.</strong><p>Un cookie permet de compter vos visites et les sections consultées dans le temps. Il ne contient pas votre nom. Nous ne recueillons ni adresse IP dans les statistiques, ni nom de fichier, ni contenu CSV. Vous pouvez refuser ou retirer votre accord à tout moment.</p></div>
      <div className="consent-actions"><button type="button" className="consent-reject" onClick={() => onChoose(false)}>Refuser</button><button type="button" className="consent-accept" onClick={() => onChoose(true)}>Accepter les statistiques</button></div>
    </aside>
  )
}

function AnalyticsAdmin() {
  const [token, setToken] = useState('')
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadSummary(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/analytics/summary`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.detail || 'Impossible de charger les statistiques.')
      setSummary(payload)
    } catch (requestError) {
      setSummary(null)
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-site">
      <header className="site-header"><a className="wordmark" href="/"><span className="logo-icon">d</span>dataclair<span className="wordmark-period">.</span></a><a className="back-link" href="/">Retour à l’outil ↗</a></header>
      <main className="admin-main"><p className="eyebrow">ESPACE ADMINISTRATEUR</p><h1>Mesure d’audience</h1><p className="admin-intro">Statistiques agrégées des visiteurs ayant accepté les cookies de mesure. Aucun nom ni identifiant individuel n’est affiché.</p>
        <form className="admin-key-form" onSubmit={loadSummary}><label htmlFor="analytics-token">Clé administrateur</label><input id="analytics-token" type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" required /><button type="submit" disabled={loading}>{loading ? 'Chargement…' : 'Afficher les statistiques'}</button></form>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {summary && <section className="admin-results"><div className="admin-metrics"><Metric label="VISITEURS ESTIMÉS" value={summary.visitors_total} tone="green" /><Metric label="VISITEURS · 7 JOURS" value={summary.visitors_7d} tone="blue" /><Metric label="SECTIONS CONSULTÉES" value={summary.views_total} tone="orange" /><Metric label="ACTIONS ENREGISTRÉES" value={summary.events_total} tone="red" /></div>
          <section className="report-panel admin-daily"><PanelTitle eyebrow="TENDANCE · 7 JOURS" title="Visiteurs et consultations" />{summary.daily.length ? <div className="admin-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.daily} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e9ece7" strokeDasharray="3 5" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#7a857d', fontSize: 9 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#7a857d', fontSize: 9 }} allowDecimals={false} /><Tooltip contentStyle={{ border: '1px solid #e2e7e1', borderRadius: 3, fontSize: 11 }} /><Bar dataKey="visitors" name="Visiteurs" fill="#236c59" radius={[2, 2, 0, 0]} /><Bar dataKey="views" name="Vues de l’accueil" fill="#d27a4b" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyPanel text="Aucune visite avec consentement sur les sept derniers jours." />}</section>
          <div className="admin-tables"><section className="report-panel"><PanelTitle eyebrow="PARCOURS" title="Sections consultées" />{summary.sections.length ? <div className="admin-list">{summary.sections.map((item) => <div key={item.section}><span>{sectionLabel(item.section)}</span><strong>{item.views} vues</strong><small>{item.visitors} visiteurs</small></div>)}</div> : <EmptyPanel text="Aucune visite avec consentement pour le moment." />}</section>
            <section className="report-panel"><PanelTitle eyebrow="INTERACTIONS" title="Actions réalisées" />{summary.actions.length ? <div className="admin-list">{summary.actions.map((item) => <div key={item.event_name}><span>{eventLabel(item.event_name)}</span><strong>{item.count}</strong><small>{item.visitors} visiteurs</small></div>)}</div> : <EmptyPanel text="Aucune action mesurée pour le moment." />}</section></div>
          <p className="admin-retention">Les événements sont supprimés automatiquement après {summary.retention_days} jours. Le jeton administrateur reste uniquement en mémoire dans cette page.</p>
        </section>}
      </main>
    </div>
  )
}

function sectionLabel(section) {
  return ({ home: 'Accueil', upload: 'Import du fichier', results: 'Résultats', distribution: 'Distribution', categories: 'Catégories', correlations: 'Corrélations', scatter: 'Nuage de points', statistics: 'Statistiques', quality: 'Qualité des données' })[section] || section
}

function eventLabel(event) {
  return ({ file_selected: 'Fichier sélectionné', analysis_started: 'Analyse démarrée', analysis_succeeded: 'Analyse réussie', analysis_failed: 'Analyse échouée', report_downloaded: 'Rapport téléchargé' })[event] || event
}

function App() {
  return window.location.pathname.replace(/\/$/, '') === '/admin/analytics'
    ? <AnalyticsAdmin />
    : <AnalyzerApp />
}

export default App