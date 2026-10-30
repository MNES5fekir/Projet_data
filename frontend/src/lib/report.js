import { correlationLabel, displayFilename, escapeHtml, formatNumber } from './format'

const REPORT_STYLES = 'body{max-width:980px;margin:40px auto;padding:0 24px;color:#26332d;font:15px/1.55 Arial,sans-serif}header{padding-bottom:22px;border-bottom:3px solid #236c59}h1{font-size:30px}h2{margin-top:34px;font-size:19px}p,.muted{color:#748077}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:24px 0}.metric{padding:15px;border:1px solid #e0e6df}.metric small{display:block;color:#78847b}.metric strong{display:block;margin-top:7px;font-size:24px}table{width:100%;border-collapse:collapse;margin:12px 0 26px;font-size:13px}th,td{padding:10px;border-bottom:1px solid #e8ece7;text-align:left}th{background:#f3f6f1}footer{margin-top:36px;padding-top:12px;border-top:1px solid #e0e6df;color:#748077;font-size:12px}@media(max-width:650px){.metrics{grid-template-columns:repeat(2,1fr)}body{margin:20px auto}}'

function tableRows(items, renderRow, emptyMessage, columnCount) {
  return items.length
    ? items.map(renderRow).join('')
    : `<tr><td colspan="${columnCount}">${emptyMessage}</td></tr>`
}

function reportHtml(result) {
  const { analysis } = result
  const filename = displayFilename(result.filename)
  const overview = analysis.overview
  const correlations = tableRows(
    analysis.correlations,
    ({ column, other_column, value }) => `<tr><td>${escapeHtml(column)}</td><td>${escapeHtml(other_column)}</td><td>${value.toFixed(3)}</td><td>${correlationLabel(value)}</td></tr>`,
    'Aucune paire numérique exploitable.',
    4,
  )
  const statistics = tableRows(
    Object.entries(analysis.statistics),
    ([name, stats]) => `<tr><td>${escapeHtml(name)}</td><td>${formatNumber(stats.mean)}</td><td>${formatNumber(stats.median)}</td><td>${formatNumber(stats.min)}</td><td>${formatNumber(stats.max)}</td><td>${formatNumber(stats.std)}</td></tr>`,
    'Aucune colonne numérique.',
    6,
  )
  const columns = analysis.columns.map((column) => `<tr><td>${escapeHtml(column.name)}</td><td>${escapeHtml(column.type)}</td><td>${column.unique_values}</td><td>${column.missing_values}</td><td>${column.missing_percentage}%</td></tr>`).join('')

  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Rapport - ${escapeHtml(filename)}</title><style>${REPORT_STYLES}</style><body>
<header><p>DATACLAIR · RAPPORT D’ANALYSE</p><h1>${escapeHtml(filename)}</h1><p>Rapport généré le ${new Date().toLocaleDateString('fr-FR')}</p></header>
<section class="metrics"><div class="metric"><small>Lignes</small><strong>${overview.rows.toLocaleString('fr-FR')}</strong></div><div class="metric"><small>Colonnes</small><strong>${overview.columns}</strong></div><div class="metric"><small>Valeurs manquantes</small><strong>${overview.missing_values}</strong></div><div class="metric"><small>Doublons</small><strong>${overview.duplicates}</strong></div></section>
<h2>Corrélations numériques</h2><p class="muted">Corrélation de Pearson : relation linéaire comprise entre -1 et 1. Une corrélation n’implique pas une causalité.</p>
<table><thead><tr><th>Variable A</th><th>Variable B</th><th>Coefficient</th><th>Lecture</th></tr></thead><tbody>${correlations}</tbody></table>
<h2>Statistiques numériques</h2>
<table><thead><tr><th>Colonne</th><th>Moyenne</th><th>Médiane</th><th>Min</th><th>Max</th><th>Écart-type</th></tr></thead><tbody>${statistics}</tbody></table>
<h2>Qualité des colonnes</h2>
<table><thead><tr><th>Colonne</th><th>Type</th><th>Valeurs uniques</th><th>Manquantes</th><th>% manquant</th></tr></thead><tbody>${columns}</tbody></table>
<footer>Généré par DataClair · L’analyse est calculée à partir du fichier importé.</footer></body></html>`
}

export function downloadReport(result) {
  const url = URL.createObjectURL(new Blob([reportHtml(result)], { type: 'text/html;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${displayFilename(result.filename).replace(/\.csv$/i, '')}-rapport.html`
  link.click()
  URL.revokeObjectURL(url)
}
