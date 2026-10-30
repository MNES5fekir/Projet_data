const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_/i

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

export function displayFilename(filename) {
  return filename.replace(UUID_PREFIX, '')
}

export function formatNumber(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  return Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

export function correlationStrength(value) {
  const absolute = Math.abs(value)
  return absolute >= 0.7 ? 'Forte' : absolute >= 0.4 ? 'Modérée' : absolute >= 0.2 ? 'Faible' : 'Très faible'
}

export function correlationDirection(value) {
  return value < 0 ? 'négative' : 'positive'
}

export function correlationLabel(value) {
  return `${correlationStrength(value)} ${correlationDirection(value)}`
}

const SECTION_LABELS = {
  home: 'Accueil',
  upload: 'Import du fichier',
  results: 'Résultats',
  distribution: 'Distribution',
  categories: 'Catégories',
  correlations: 'Corrélations',
  scatter: 'Nuage de points',
  statistics: 'Statistiques',
  quality: 'Qualité des données',
}

const EVENT_LABELS = {
  file_selected: 'Fichier sélectionné',
  analysis_started: 'Analyse démarrée',
  analysis_succeeded: 'Analyse réussie',
  analysis_failed: 'Analyse échouée',
  report_downloaded: 'Rapport téléchargé',
}

export function sectionLabel(section) {
  return SECTION_LABELS[section] || section
}

export function eventLabel(event) {
  return EVENT_LABELS[event] || event
}
