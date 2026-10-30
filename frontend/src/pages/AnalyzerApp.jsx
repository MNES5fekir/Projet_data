import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import ConsentBanner from '../components/ConsentBanner'
import { Wordmark } from '../components/ui'
import { analyzeFile, fetchConsent, saveConsent, sendAnalyticsEvent } from '../lib/api'
import { displayFilename } from '../lib/format'

// Recharts est lourd : le tableau de bord n'est chargé qu'au moment où un fichier est choisi.
const loadDashboard = () => import('../components/AnalysisDashboard')
const AnalysisDashboard = lazy(loadDashboard)

const MAX_FILE_BYTES = 10 * 1024 * 1024
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

// renderedResult change quand le tableau de bord est réellement affiché, pour observer ses sections.
function useAnalyticsConsent(renderedResult) {
  const [consent, setConsent] = useState('loading')
  const seenSections = useRef(new Set())
  const pageViewRecorded = useRef(false)

  useEffect(() => {
    fetchConsent().then(setConsent).catch(() => setConsent('unavailable'))
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
  }, [consent, renderedResult])

  async function choose(accepted) {
    try {
      await saveConsent(accepted)
      seenSections.current.clear()
      setConsent(accepted ? 'accepted' : 'rejected')
    } catch {
      setConsent('unavailable')
    }
  }

  function track(event, section) {
    if (consent === 'accepted') sendAnalyticsEvent(event, section)
  }

  return {
    consent,
    choose,
    track,
    reopen: () => setConsent('unknown'),
    resetSections: () => seenSections.current.clear(),
  }
}

export default function AnalyzerApp() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [renderedResult, setRenderedResult] = useState(null)
  const fileInput = useRef(null)
  const analytics = useAnalyticsConsent(renderedResult)

  function selectFile(selectedFile) {
    if (!selectedFile) return
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Choisissez un fichier au format CSV.')
      return
    }
    if (selectedFile.size > MAX_FILE_BYTES) {
      setError('Le fichier dépasse la limite de 10 Mo.')
      return
    }
    loadDashboard()
    setFile(selectedFile)
    setError('')
    setResult(null)
    analytics.track('file_selected', 'upload')
  }

  async function submitFile(event) {
    event.preventDefault()
    if (!file || loading) return
    setLoading(true)
    setError('')
    analytics.track('analysis_started', 'upload')
    try {
      const analysis = await analyzeFile(file)
      setResult(analysis)
      analytics.resetSections()
      analytics.track('analysis_succeeded', 'results')
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      requestAnimationFrame(() => document.getElementById('analysis-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (uploadError) {
      setError(uploadError.message)
      analytics.track('analysis_failed', 'upload')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload() {
    if (!result) return
    analytics.track('report_downloaded', 'results')
    const { downloadReport } = await import('../lib/report')
    downloadReport(result)
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    selectFile(event.dataTransfer.files[0])
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false)
  }

  return (
    <>
      <div className="site-shell">
        <header className="site-header">
          <Wordmark href="#accueil" aria-label="DataClair, accueil" />
          <nav><a href="#outil">L’outil</a><a href="#comment-ca-marche">Comment ça marche</a></nav>
          <span className="header-note"><i /> Gratuit · sans inscription</span>
        </header>

        <main id="accueil">
          <section className="intro" id="outil">
            <div className="intro-copy">
              <p className="eyebrow">ANALYSE DE FICHIERS CSV</p>
              <h1>Vos données ont<br />beaucoup à <em>dire.</em></h1>
              <p className="intro-description">Importez un fichier. Découvrez ses tendances, ses liens et ses points à surveiller en un instant.</p>
            </div>
            <div className="intro-aside" aria-hidden="true">
              <div className="aside-top"><span>APERÇU DES DONNÉES</span><span>01 — 08</span></div>
              <div className="mini-chart">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
              <div className="aside-bottom"><span>Une lecture claire, sans détour.</span><span>CSV / 10 MB</span></div>
            </div>
          </section>

          <form
            id="upload-section"
            className={`upload-surface ${dragging ? 'is-dragging' : ''}`}
            onSubmit={submitFile}
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={(event) => selectFile(event.target.files[0])} aria-label="Choisir un fichier CSV" />
            <span className="upload-symbol" aria-hidden="true">↑</span>
            <div className="upload-copy">
              <strong>{file ? displayFilename(file.name) : 'Déposez votre fichier CSV ici'}</strong>
              <span>{file ? `${(file.size / 1024).toFixed(0)} Ko · prêt à analyser` : 'ou sélectionnez-le depuis votre appareil'}</span>
            </div>
            <button type="button" className="browse-button" onClick={() => fileInput.current?.click()}>{file ? 'Changer de fichier' : 'Choisir un fichier'}</button>
            <button className="analyze-button" type="submit" disabled={!file || loading}>
              {loading ? <><span className="button-spinner" /> Analyse…</> : <>Analyser le fichier <span aria-hidden="true">↗</span></>}
            </button>
            <span className="upload-limit">CSV uniquement · 10 Mo maximum · Fichier non conservé</span>
          </form>
          {error && <p className="error-message" role="alert">{error}</p>}

          {!result && (
            <section className="how-strip" id="comment-ca-marche">
              <div><span>01</span><p><strong>Importez</strong> votre fichier CSV.</p></div>
              <div><span>02</span><p><strong>Explorez</strong> les statistiques et graphiques.</p></div>
              <div><span>03</span><p><strong>Exportez</strong> un rapport prêt à partager.</p></div>
            </section>
          )}

          {result && (
            <Suspense fallback={null}>
              <AnalysisDashboard result={result} onDownload={handleDownload} onRendered={setRenderedResult} />
            </Suspense>
          )}
        </main>
        <footer className="site-footer">
          <span>DATACLAIR · ANALYSE LOCALE</span>
          <span>Votre fichier est traité temporairement et n’est pas conservé.</span>
          <button type="button" onClick={analytics.reopen}>Préférences cookies</button>
          <a href="/admin/analytics">Statistiques du site</a>
        </footer>
      </div>
      {analytics.consent === 'unknown' && <ConsentBanner onChoose={analytics.choose} />}
    </>
  )
}
