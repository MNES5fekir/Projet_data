// Client API + session
const KEY = 'nk_token';
const store = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* navigation privée */ } },
};

export const session = { token: store.get(), user: null, meta: null };
const listeners = new Set();
export const onSession = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn(session.user));

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new Error('Connexion impossible. Vérifiez votre réseau.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && session.token) logout(false);
    const err = new Error(data.error || 'Une erreur est survenue.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export function setSession(token, user) {
  session.token = token;
  session.user = user;
  store.set(token);
  emit();
}

export async function refreshUser() {
  if (!session.token) { session.user = null; emit(); return null; }
  try {
    const { user } = await api('/auth/me');
    session.user = user;
  } catch {
    session.user = null;
  }
  emit();
  return session.user;
}

export function logout(redirect = true) {
  session.token = null;
  session.user = null;
  store.set(null);
  emit();
  if (redirect) location.hash = '#/';
}

export async function loadMeta() {
  if (!session.meta) session.meta = await api('/tailors/meta');
  return session.meta;
}
