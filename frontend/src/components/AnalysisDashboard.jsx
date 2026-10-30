import { useEffect, useMemo, useState } from 'react'
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
import { axisProps, barMargin, chartColors, gridProps, tooltipStyle } from '../lib/chartTheme'
import { correlationDirection, correlationStrength, displayFilename, formatNumber } from '../lib/format'
import { EmptyPanel, Metric, PanelTitle } from './ui'

export default function AnalysisDashboard({ result, onDownload, onRendered }) {
  const { analysis, charts } = result

  useEffect(() => {
    onRendered?.(result)
  }, [result, onRendered])

  const overview = analysis.overview
  const stats = analysis.statistics

  return (
    <section className="results" id="analysis-results">
      <div className="results-heading">
        <div><p className="eyebrow">RAPPORT D’ANALYSE</p><h2>{displayFilename(result.filename)}</h2><p>Profil généré à partir de {overview.rows.toLocaleString('fr-FR')} lignes.</p></div>
        <button className="download-button" type="button" onClick={onDownload}><span aria-hidden="true">↓</span> Télécharger le rapport</button>
      </div>

      <div className="metric-grid">
        <Metric label="LIGNES" value={overview.rows} tone="green" />
        <Metric label="COLONNES" value={overview.columns} tone="blue" />
        <Metric label="VALEURS MANQUANTES" value={overview.missing_values} tone="orange" />
        <Metric label="DOUBLONS" value={overview.duplicates} tone="red" />
      </div>

      <div className="visual-grid">
        <DistributionPanel histograms={charts.histograms} />
        <CategoryPanel categories={charts.categories} />
      </div>

      <div className="visual-grid correlations-grid">
        <section className="report-panel correlation-panel" id="correlations-section">
          <PanelTitle eyebrow="RELATIONS ENTRE VARIABLES" title="Corrélations détaillées" />
          <p className="panel-description">Coefficient de Pearson · de −1 (inverse) à +1 (ensemble). Une corrélation ne prouve pas une causalité.</p>
          {analysis.correlations.length
            ? <div className="correlation-list">{analysis.correlations.map((pair) => <CorrelationRow key={`${pair.column}-${pair.other_column}`} pair={pair} />)}</div>
            : <EmptyPanel text="Il faut au moins deux colonnes numériques pour calculer une corrélation." />}
        </section>
        <ScatterPanel scatter={charts.scatter.find((pair) => pair.x_column !== pair.y_column)} />
      </div>

      <section className="report-panel stats-panel" id="statistics-section">
        <PanelTitle eyebrow="STATISTIQUES DESCRIPTIVES" title="Comprendre les colonnes numériques" />
        <div className="table-scroll">
          <table>
            <thead><tr><th>Colonne</th><th>Moyenne</th><th>Médiane</th><th>Minimum</th><th>Maximum</th><th>Écart-type</th></tr></thead>
            <tbody>{Object.entries(stats).map(([column, values]) => (
              <tr key={column}><td>{column}</td><td>{formatNumber(values.mean)}</td><td>{formatNumber(values.median)}</td><td>{formatNumber(values.min)}</td><td>{formatNumber(values.max)}</td><td>{formatNumber(values.std)}</td></tr>
            ))}</tbody>
          </table>
          {!Object.keys(stats).length && <EmptyPanel text="Aucune statistique numérique disponible." />}
        </div>
      </section>

      <section className="report-panel quality-panel" id="quality-section">
        <PanelTitle eyebrow="QUALITÉ DES DONNÉES" title="État de chaque colonne" />
        <div className="table-scroll">
          <table>
            <thead><tr><th>Colonne</th><th>Type</th><th>Valeurs uniques</th><th>Manquantes</th><th>Part manquante</th><th>Valeurs atypiques</th></tr></thead>
            <tbody>{analysis.columns.map((column) => {
              const outlier = analysis.outliers[column.name]
              return (
                <tr key={column.name}>
                  <td>{column.name}</td>
                  <td>{column.type}</td>
                  <td>{column.unique_values.toLocaleString('fr-FR')}</td>
                  <td>{column.missing_values.toLocaleString('fr-FR')}</td>
                  <td><span className={column.missing_percentage ? 'quality-warning' : 'quality-good'}>{column.missing_percentage}%</span></td>
                  <td>{outlier ? `${outlier.count} (${outlier.percentage}%)` : '—'}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

function DistributionPanel({ histograms }) {
  const [activeColumn, setActiveColumn] = useState(histograms[0]?.column || '')
  const histogram = histograms.find((item) => item.column === activeColumn) || histograms[0]
  const data = useMemo(
    () => histogram?.labels.map((label, index) => ({ label, count: histogram.values[index] })) || [],
    [histogram],
  )

  return (
    <section className="report-panel distribution-panel" id="distribution-section">
      <PanelTitle eyebrow="DISTRIBUTION" title="Répartition des valeurs" />
      {histogram ? <>
        <label className="select-label" htmlFor="histogram-column">Colonne numérique</label>
        <select id="histogram-column" value={histogram.column} onChange={(event) => setActiveColumn(event.target.value)}>
          {histograms.map((item) => <option key={item.column} value={item.column}>{item.column}</option>)}
        </select>
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={barMargin}>
              <CartesianGrid vertical={false} {...gridProps} />
              <XAxis dataKey="label" {...axisProps()} />
              <YAxis {...axisProps()} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Nombre de valeurs" fill="#276f5b" radius={[2, 2, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="chart-caption">Moyenne <strong>{formatNumber(histogram.mean)}</strong><span /> Médiane <strong>{formatNumber(histogram.median)}</strong></p>
      </> : <EmptyPanel text="Aucune colonne numérique à représenter." />}
    </section>
  )
}

function CategoryPanel({ categories }) {
  const profile = categories.find((item) => item.values.some((value) => value > 1)) || categories[0]
  const max = profile ? Math.max(...profile.values, 1) : 1

  return (
    <section className="report-panel category-panel" id="categories-section">
      <PanelTitle eyebrow="PROFIL CATÉGORIEL" title="Valeurs les plus fréquentes" />
      {profile ? (
        <div className="category-list">
          {profile.labels.map((label, index) => (
            <div className="category-row" key={label}>
              <span className="category-label" title={label}>{label}</span>
              <span className="category-track"><i style={{ width: `${profile.values[index] / max * 100}%`, background: chartColors[index % chartColors.length] }} /></span>
              <strong>{profile.values[index]}</strong>
            </div>
          ))}
          <p className="chart-caption">Colonne <strong>{profile.column}</strong> · occurrences</p>
        </div>
      ) : <EmptyPanel text="Aucune colonne catégorielle exploitable." />}
    </section>
  )
}

function ScatterPanel({ scatter }) {
  return (
    <section className="report-panel scatter-panel" id="scatter-section">
      <PanelTitle eyebrow="RELATION BIVARIÉE" title="Nuage de points" />
      {scatter ? <>
        <p className="scatter-label">{scatter.x_column}<span> × </span>{scatter.y_column}</p>
        <div className="scatter-frame">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid {...gridProps} />
              <XAxis type="number" dataKey="x" name={scatter.x_column} {...axisProps(9)} />
              <YAxis type="number" dataKey="y" name={scatter.y_column} {...axisProps(9)} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={scatter.points} fill="#d27a4b" fillOpacity={0.72} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </> : <EmptyPanel text="Ajoutez deux colonnes numériques pour explorer leur relation." />}
    </section>
  )
}

function CorrelationRow({ pair }) {
  const { value } = pair
  const tone = value < 0 ? 'negative' : 'positive'
  return (
    <div className="correlation-row">
      <div className="relation-names"><strong>{pair.column}</strong><span>avec</span><strong>{pair.other_column}</strong></div>
      <div className="relation-track"><i className={tone} style={{ width: `${Math.abs(value) * 100}%` }} /></div>
      <div className="relation-result"><strong className={`${tone}-text`}>{value > 0 ? '+' : ''}{value.toFixed(3)}</strong><span>{correlationStrength(value)} {correlationDirection(value)}</span></div>
    </div>
  )
}
