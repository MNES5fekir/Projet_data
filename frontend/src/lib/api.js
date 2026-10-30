export const API_URL = import.meta.env.VITE_API_URL || '/api'

async function requestJson(path, options, fallbackError) {
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include', ...options })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.detail || fallbackError)
  return payload
}

export async function sendAnalyticsEvent(event, section) {
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

export function analyzeFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  return requestJson('/analysis', { method: 'POST', body: formData }, 'Le fichier n’a pas pu être analysé.')
}

export async function fetchConsent() {
  const { choice } = await requestJson('/analytics/consent', {}, 'Consentement indisponible')
  return choice
}

export function saveConsent(accepted) {
  return requestJson('/analytics/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accepted }),
  }, 'Consentement indisponible')
}

export function fetchAnalyticsSummary(token) {
  return requestJson('/analytics/summary', {
    headers: { Authorization: `Bearer ${token}` },
  }, 'Impossible de charger les statistiques.')
}
