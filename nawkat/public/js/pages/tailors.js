import { api, loadMeta } from '../api.js';
import { esc, fcfa, icon, avatar, rating, options, empty, hueFor, $, $$ } from '../ui.js';

export function tailorCard(t) {
  const g = t.gallery || [];
  const img = (src) => (src ? `<img src="${esc(src)}" alt="" loading="lazy">` : '');
  const cover = g.length >= 3
    ? `<div class="g">${img(g[0])}</div><div class="g2"><div class="g">${img(g[1])}</div><div class="g">${img(g[2])}</div></div>`
    : t.cover || g[0]
      ? `<div class="g" style="grid-column:1/-1">${img(t.cover || g[0])}</div>`
      : '';
  return `<a class="card tailor-card" href="#/t/${esc(t.slug)}">
    <div class="cover" style="background-color:${hueFor(t.id)}">${cover}</div>
    <div class="body">
      ${avatar(t.avatar, t.shop_name, t.id)}
      <h3>${esc(t.shop_name)} ${t.verified ? icon.verified : ''}</h3>
      <div class="small muted">${esc(t.tagline || t.specialties.slice(0, 3).join(' · '))}</div>
      <div class="meta">
        <span class="row" style="gap:4px">${icon.pin.replace('<svg', '<svg style="width:14px;height:14px"')} ${esc(t.district ? `${t.district}, ` : '')}${esc(t.city)}</span>
        ${t.on_time_rate != null ? `<span>⏱ ${Math.round(t.on_time_rate * 100)} % à l’heure</span>` : ''}
        ${t.completed_count ? `<span>${t.completed_count} commandes</span>` : ''}
      </div>
      <div class="foot">
        ${rating(t.score, t.review_count)}
        <span class="price">${t.min_price ? `<small>dès</small> ${fcfa(t.min_price)}` : '<small>Sur devis</small>'}</span>
      </div>
    </div>
  </a>`;
}

export async function render({ app, query }) {
  const meta = await loadMeta();
  document.title = 'Trouver un tailleur — Ñawkat';
  app.innerHTML = `<div class="container" style="padding-top:32px;padding-bottom:40px">
    <div class="page-title"><div><h1>Trouver un tailleur</h1><p class="muted" style="margin:0">Comparez les notes, les délais et les prix des tailleurs vérifiés.</p></div>
      <button class="btn btn-outline btn-sm filter-toggle" id="ftoggle" type="button">${icon.search} Filtres</button></div>
    <div class="layout-side">
      <form class="card card-body filters" id="filters">
        <label class="field"><span>Recherche</span><input class="input" name="q" placeholder="Nom, style, quartier…" value="${esc(query.q || '')}"></label>
        <label class="field"><span>Ville</span><select class="input" name="city">${options(meta.cities, query.city, 'Tout le Sénégal')}</select></label>
        <label class="field"><span>Spécialité</span><select class="input" name="specialty">${options(meta.specialties, query.specialty, 'Toutes')}</select></label>
        <label class="field"><span>Pour</span><select class="input" name="audience">${options([['femme', 'Femme'], ['homme', 'Homme'], ['enfant', 'Enfant']], query.audience, 'Tous')}</select></label>
        <label class="field"><span>Budget maximum</span><select class="input" name="max_price">${options([[10000, '10 000 FCFA'], [25000, '25 000 FCFA'], [50000, '50 000 FCFA'], [100000, '100 000 FCFA']], query.max_price, 'Indifférent')}</select></label>
        <label class="field"><span>Note minimale</span><select class="input" name="min_rating">${options([[4.5, '4,5 ★ et plus'], [4, '4 ★ et plus'], [3.5, '3,5 ★ et plus']], query.min_rating, 'Toutes')}</select></label>
        <div class="field stack" style="margin-top:16px">
          <label class="check"><input type="checkbox" name="verified" value="1" ${query.verified === '1' ? 'checked' : ''}> Tailleurs vérifiés uniquement</label>
          <label class="check"><input type="checkbox" name="home_delivery" value="1" ${query.home_delivery === '1' ? 'checked' : ''}> Livraison à domicile</label>
        </div>
        <button type="button" class="btn btn-ghost btn-sm btn-block" id="reset" style="margin-top:16px">Réinitialiser</button>
      </form>
      <div>
        <div class="toolbar">
          <strong id="count"></strong>
          <label class="row small" style="gap:8px">Trier par
            <select class="input" id="sort" style="width:auto;padding:8px 12px">${options([['recommended', 'Recommandés'], ['rating', 'Mieux notés'], ['reviews', 'Plus d’avis'], ['price', 'Prix croissant'], ['recent', 'Nouveaux']], query.sort || 'recommended')}</select>
          </label>
        </div>
        <div class="grid grid-3" id="results"></div>
        <div class="pagination" id="pager"></div>
      </div>
    </div>
  </div>`;

  const form = $('#filters');
  $('#ftoggle').onclick = () => form.classList.toggle('open');
  const state = { ...query };
  let timer;

  const load = async () => {
    const qs = new URLSearchParams(Object.entries(state).filter(([, v]) => v)).toString();
    history.replaceState(null, '', `#/tailleurs${qs ? `?${qs}` : ''}`);
    $('#results').innerHTML = '<div class="skeleton" style="height:320px"></div>'.repeat(3);
    const data = await api(`/tailors?${qs}`);
    $('#count').textContent = `${data.total} tailleur${data.total > 1 ? 's' : ''}`;
    $('#results').innerHTML = data.items.length
      ? data.items.map(tailorCard).join('')
      : `<div style="grid-column:1/-1">${empty('🧵', 'Aucun tailleur trouvé', 'Essayez d’élargir vos critères de recherche.')}</div>`;
    $('#pager').innerHTML = data.pages > 1
      ? Array.from({ length: data.pages }, (_, i) => `<button class="btn btn-sm ${i + 1 === data.page ? 'btn-primary' : 'btn-outline'}" data-page="${i + 1}">${i + 1}</button>`).join('')
      : '';
    $$('[data-page]').forEach((b) => (b.onclick = () => { state.page = b.dataset.page; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  };

  const sync = () => {
    const fd = new FormData(form);
    for (const k of ['q', 'city', 'specialty', 'audience', 'max_price', 'min_rating', 'verified', 'home_delivery']) state[k] = fd.get(k) || '';
    state.page = '';
    load();
  };
  form.addEventListener('change', sync);
  form.q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(sync, 350); });
  form.addEventListener('submit', (e) => { e.preventDefault(); sync(); });
  $('#sort').onchange = (e) => { state.sort = e.target.value; load(); };
  $('#reset').onclick = () => { form.reset(); [...form.elements].forEach((el) => { if (el.type !== 'checkbox' && el.type !== 'button') el.value = ''; else el.checked = false; }); sync(); };
  await load();
}
