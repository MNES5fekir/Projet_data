import { api, loadMeta } from '../api.js';
import { esc, fcfa, num, date, onSubmit, toast, $, $$ } from '../ui.js';
import { dash } from '../layout.js';

const TST = { active: ['En ligne', 'badge-verified'], pending_payment: ['Non payé', 'badge-accent'], suspended: ['Suspendu', 'badge-red'] };
const PST = { pending: 'badge-accent', paid: 'badge-verified', failed: 'badge-red', refunded: '' };

export async function render({ app, query }) {
  const tab = query.tab || 'overview';
  const meta = await loadMeta();
  document.title = 'Administration — Ñawkat';
  const tabs = [['overview', 'Vue d’ensemble'], ['tailors', 'Tailleurs'], ['disputes', 'Litiges'], ['payouts', 'Retraits'], ['payments', 'Paiements'], ['settings', 'Paramètres']];
  let content = '';

  if (tab === 'overview') {
    const { totals: t, by_status } = await api('/admin/stats');
    content = `<div class="kpis">
        <div class="kpi"><strong>${fcfa(t.gmv)}</strong><span>Volume payé (commandes)</span></div>
        <div class="kpi"><strong>${fcfa(t.commissions)}</strong><span>Commissions encaissées</span></div>
        <div class="kpi"><strong>${fcfa(t.registration_revenue)}</strong><span>Frais d’inscription</span></div>
        <div class="kpi"><strong>${num(t.orders)}</strong><span>Commandes</span></div>
        <div class="kpi"><strong>${num(t.clients)}</strong><span>Clients</span></div>
        <div class="kpi"><strong>${num(t.tailors_active)}</strong><span>Tailleurs en ligne</span></div>
        <div class="kpi"><strong>${num(t.tailors_pending)}</strong><span>Inscriptions non payées</span></div>
        <div class="kpi" style="${t.disputes ? 'border-color:var(--red)' : ''}"><strong>${num(t.disputes)}</strong><span>Litiges ouverts</span></div>
      </div>
      <div class="card card-body" style="margin-top:20px"><h3>Commandes par statut</h3><div class="row">${by_status.map((s) => `<span class="status st-${s.status}">${esc(meta.order_status[s.status])} · ${s.n}</span>`).join('')}</div></div>`;
  } else if (tab === 'tailors') {
    const { items } = await api('/admin/tailors');
    content = `<div class="card table-wrap"><table class="table"><thead><tr><th>Boutique</th><th>Contact</th><th>Ville</th><th>Note</th><th>Statut</th><th></th></tr></thead><tbody>
      ${items.map((t) => `<tr><td><a href="#/t/${esc(t.slug)}"><strong>${esc(t.shop_name)}</strong></a>${t.verified ? ' ✓' : ''}<div class="xs muted">depuis ${date(t.created_at)}</div></td>
        <td>${esc(t.full_name)}<div class="xs muted">${esc(t.phone)}</div></td><td>${esc(t.city)}</td>
        <td>${t.score != null ? `${t.score.toFixed(1)} (${t.review_count})` : '—'}</td>
        <td><span class="badge ${TST[t.status][1]}">${TST[t.status][0]}</span></td>
        <td class="row" style="flex-wrap:nowrap"><button class="btn btn-sm btn-outline" data-verify="${t.id}" data-v="${t.verified ? 0 : 1}">${t.verified ? 'Retirer ✓' : 'Vérifier'}</button>
          ${t.status === 'active' ? `<button class="btn btn-sm btn-danger" data-status="${t.id}" data-s="suspended">Suspendre</button>` : t.status === 'suspended' ? `<button class="btn btn-sm btn-outline" data-status="${t.id}" data-s="active">Réactiver</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>`;
  } else if (tab === 'disputes') {
    const { items } = await api('/admin/disputes');
    content = items.length ? items.map((d) => `<div class="card card-body" style="margin-bottom:12px">
        <div class="row between"><div><strong>${esc(d.ref)} — ${esc(d.title)}</strong><div class="small muted">${esc(d.client_name)} → ${esc(d.shop_name)} · ${fcfa(d.quote_amount)}</div></div>
        <a class="btn btn-sm btn-ghost" href="#/commandes/${d.id}">Détail</a></div>
        <p style="margin:12px 0;padding:12px;background:var(--red-50);border-radius:10px">« ${esc(d.reason)} »</p>
        <div class="row"><button class="btn btn-sm btn-success" data-resolve="${d.id}" data-o="release">Payer le tailleur</button><button class="btn btn-sm btn-danger" data-resolve="${d.id}" data-o="refund">Rembourser le client</button></div>
      </div>`).join('') : '<div class="card card-body muted">Aucun litige en cours 🎉</div>';
  } else if (tab === 'payouts') {
    const { items } = await api('/admin/payouts');
    content = `<div class="card table-wrap"><table class="table"><thead><tr><th>Date</th><th>Tailleur</th><th>Montant</th><th>Vers</th><th>Statut</th><th></th></tr></thead><tbody>
      ${items.map((p) => `<tr><td>${date(p.created_at)}</td><td>${esc(p.shop_name)}</td><td><strong>${fcfa(p.amount)}</strong></td><td>${esc(p.method)} · ${esc(p.phone)}</td><td>${esc(p.status)}</td>
        <td>${p.status === 'requested' ? `<button class="btn btn-sm btn-success" data-payout="${p.id}" data-s="paid">Marquer versé</button> <button class="btn btn-sm btn-ghost" data-payout="${p.id}" data-s="rejected">Refuser</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Aucune demande.</td></tr>'}
      </tbody></table></div>`;
  } else if (tab === 'payments') {
    const { items } = await api('/admin/payments');
    content = `<div class="card table-wrap"><table class="table"><thead><tr><th>Réf.</th><th>Type</th><th>Payeur</th><th>Montant</th><th>Moyen</th><th>Statut</th><th>Date</th></tr></thead><tbody>
      ${items.map((p) => `<tr><td class="small">${esc(p.ref)}</td><td>${p.kind === 'registration' ? 'Inscription' : 'Commande'}</td><td>${esc(p.full_name)}</td><td>${fcfa(p.amount)}</td><td>${esc(meta.payment_methods[p.method] || '—')}</td><td><span class="badge ${PST[p.status]}">${esc(p.status)}</span></td><td class="small">${date(p.created_at)}</td></tr>`).join('')}
      </tbody></table></div>`;
  } else {
    content = `<form id="sf" class="card card-body stack" style="max-width:520px"><div class="form-error hidden"></div>
      <label class="field"><span>Frais d’inscription tailleur (FCFA)</span><input class="input" type="number" name="registration_fee" min="0" value="${meta.registration_fee}"></label>
      <label class="field"><span>Commission par commande (%)</span><input class="input" type="number" name="commission_pct" min="0" max="50" step="0.5" value="${meta.commission_rate * 100}"></label>
      <button class="btn btn-primary" type="submit">Enregistrer</button></form>`;
  }

  app.innerHTML = dash(`<div class="page-title"><h1>Administration</h1></div>
    <div class="tabs">${tabs.map(([k, l]) => `<a href="#/admin?tab=${k}" class="${tab === k ? 'active' : ''}">${l}</a>`).join('')}</div>${content}`);

  const reload = () => render({ app, query: { tab } });
  const call = async (fn) => { try { await fn(); reload(); } catch (e) { toast(e.message, 'err'); } };
  $$('[data-verify]').forEach((b) => (b.onclick = () => call(() => api(`/admin/tailors/${b.dataset.verify}`, { method: 'PATCH', body: { verified: b.dataset.v === '1' } }))));
  $$('[data-status]').forEach((b) => (b.onclick = () => call(() => api(`/admin/tailors/${b.dataset.status}`, { method: 'PATCH', body: { status: b.dataset.s } }))));
  $$('[data-resolve]').forEach((b) => (b.onclick = () => confirm('Confirmer la décision ?') && call(() => api(`/admin/orders/${b.dataset.resolve}/resolve`, { method: 'POST', body: { outcome: b.dataset.o } }))));
  $$('[data-payout]').forEach((b) => (b.onclick = () => call(() => api(`/admin/payouts/${b.dataset.payout}`, { method: 'POST', body: { status: b.dataset.s } }))));
  const sf = $('#sf');
  if (sf) onSubmit(sf, async (fd) => {
    const r = await api('/admin/settings', { method: 'PUT', body: { registration_fee: Number(fd.get('registration_fee')), commission_rate: Number(fd.get('commission_pct')) / 100 } });
    Object.assign(meta, r);
    toast('Paramètres enregistrés.', 'ok');
  });
}
