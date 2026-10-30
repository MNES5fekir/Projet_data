import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyPanel, Metric, PanelTitle, Wordmark } from '../components/ui'
import { fetchAnalyticsSummary } from '../lib/api'
import { axisProps, barMargin, gridProps, tooltipStyle } from '../lib/chartTheme'
import { eventLabel, sectionLabel } from '../lib/format'

export default function AnalyticsAdmin() {
  const [token, setToken] = useState('')
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadSummary(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      setSummary(await fetchAnalyticsSummary(token))
    } catch (requestError) {
      setSummary(null)
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-site">
      <header className="site-header"><Wordmark href="/" /><a className="back-link" href="/">Retour à l’outil ↗</a></header>
      <main className="admin-main">
        <p className="eyebrow">ESPACE ADMINISTRATEUR</p>
        <h1>Mesure d’audience</h1>
        <p className="admin-intro">Statistiques agrégées des visiteurs ayant accepté les cookies de mesure. Aucun nom ni identifiant individuel n’est affiché.</p>
        <form className="admin-key-form" onSubmit={loadSummary}>
          <label htmlFor="analytics-token">Clé administrateur</label>
          <input id="analytics-token" type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" required />
          <button type="submit" disabled={loading}>{loading ? 'Chargement…' : 'Afficher les statistiques'}</button>
        </form>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {summary && <AdminSummary summary={summary} />}
      </main>
    </div>
  )
}

function AdminSummary({ summary }) {
  return (
    <section className="admin-results">
      <div className="admin-metrics">
        <Metric label="VISITEURS ESTIMÉS" value={summary.visitors_total} tone="green" />
        <Metric label="VISITEURS · 7 JOURS" value={summary.visitors_7d} tone="blue" />
        <Metric label="SECTIONS CONSULTÉES" value={summary.views_total} tone="orange" />
        <Metric label="ACTIONS ENREGISTRÉES" value={summary.events_total} tone="red" />
      </div>

      <section className="report-panel admin-daily">
        <PanelTitle eyebrow="TENDANCE · 7 JOURS" title="Visiteurs et consultations" />
        {summary.daily.length ? (
          <div className="admin-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.daily} margin={barMargin}>
                <CartesianGrid vertical={false} {...gridProps} />
                <XAxis dataKey="day" {...axisProps(9)} />
                <YAxis {...axisProps(9)} allowDecimals={false} />
                <Tooltip contentStyle={{ ...tooltipStyle, fontSize: 11 }} />
                <Bar dataKey="visitors" name="Visiteurs" fill="#236c59" radius={[2, 2, 0, 0]} />
                <Bar dataKey="views" name="Vues de l’accueil" fill="#d27a4b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyPanel text="Aucune visite avec consentement sur les sept derniers jours." />}
      </section>

      <div className="admin-tables">
        <section className="report-panel">
          <PanelTitle eyebrow="PARCOURS" title="Sections consultées" />
          {summary.sections.length ? (
            <div className="admin-list">{summary.sections.map((item) => (
              <div key={item.section}><span>{sectionLabel(item.section)}</span><strong>{item.views} vues</strong><small>{item.visitors} visiteurs</small></div>
            ))}</div>
          ) : <EmptyPanel text="Aucune visite avec consentement pour le moment." />}
        </section>
        <section className="report-panel">
          <PanelTitle eyebrow="INTERACTIONS" title="Actions réalisées" />
          {summary.actions.length ? (
            <div className="admin-list">{summary.actions.map((item) => (
              <div key={item.event_name}><span>{eventLabel(item.event_name)}</span><strong>{item.count}</strong><small>{item.visitors} visiteurs</small></div>
            ))}</div>
          ) : <EmptyPanel text="Aucune action mesurée pour le moment." />}
        </section>
      </div>
      <p className="admin-retention">Les événements sont supprimés automatiquement après {summary.retention_days} jours. Le jeton administrateur reste uniquement en mémoire dans cette page.</p>
    </section>
  )
}
