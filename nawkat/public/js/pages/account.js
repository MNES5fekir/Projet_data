import { api, session, loadMeta, refreshUser } from '../api.js';
import { esc, options, onSubmit, toast } from '../ui.js';
import { dash } from '../layout.js';

export async function render({ app }) {
  const meta = await loadMeta();
  const u = session.user;
  document.title = 'Mon compte — Ñawkat';
  const m = u.measurements || {};

  app.innerHTML = dash(`
    <div class="page-title"><h1>Mon compte</h1></div>
    <div class="stack">
      <form id="profile" class="card card-body stack"><h3>Informations personnelles</h3><div class="form-error hidden"></div>
        <div class="grid grid-2" style="gap:14px">
          <label class="field"><span>Prénom et nom</span><input class="input" name="full_name" required value="${esc(u.full_name)}"></label>
          <label class="field"><span>Téléphone</span><input class="input" value="${esc(u.phone)}" disabled><small>Identifiant de connexion.</small></label>
          <label class="field"><span>Email (facultatif)</span><input class="input" type="email" name="email" value="${esc(u.email || '')}"></label>
          <label class="field"><span>Ville</span><select class="input" name="city">${options(meta.cities, u.city, '—')}</select></label>
        </div>
        <button class="btn btn-primary" type="submit" style="align-self:flex-start">Enregistrer</button>
      </form>

      ${u.role === 'client' ? `<form id="measures" class="card card-body stack"><h3>Mes mensurations (cm)</h3>
        <p class="small muted" style="margin:0">Enregistrées une fois, elles sont proposées automatiquement à chaque commande.</p><div class="form-error hidden"></div>
        <div class="grid grid-3" style="gap:12px">${meta.measurements.map(([k, l]) => `<label class="field"><span class="small">${esc(l)}</span><input class="input" type="number" step="0.5" min="1" max="299" name="${k}" value="${esc(m[k] ?? '')}"></label>`).join('')}</div>
        <button class="btn btn-primary" type="submit" style="align-self:flex-start">Enregistrer mes mensurations</button>
      </form>` : ''}

      <form id="pwd" class="card card-body stack"><h3>Mot de passe</h3><div class="form-error hidden"></div>
        <div class="grid grid-2" style="gap:14px">
          <label class="field"><span>Mot de passe actuel</span><input class="input" type="password" name="current_password" required autocomplete="current-password"></label>
          <label class="field"><span>Nouveau mot de passe</span><input class="input" type="password" name="new_password" minlength="6" required autocomplete="new-password"></label>
        </div>
        <button class="btn btn-outline" type="submit" style="align-self:flex-start">Changer le mot de passe</button>
      </form>
    </div>`);

  const save = async (body, msg) => {
    const { user } = await api('/auth/me', { method: 'PATCH', body });
    session.user = user;
    await refreshUser();
    toast(msg, 'ok');
  };
  onSubmit(app.querySelector('#profile'), (fd) => save(Object.fromEntries(fd), 'Profil mis à jour.'));
  const mf = app.querySelector('#measures');
  if (mf) onSubmit(mf, (fd) => save({ measurements: Object.fromEntries(fd) }, 'Mensurations enregistrées.'));
  onSubmit(app.querySelector('#pwd'), async (fd, form) => { await save(Object.fromEntries(fd), 'Mot de passe modifié.'); form.reset(); });
}
