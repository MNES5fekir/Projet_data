import { api, refreshUser } from '../api.js';
import { esc, fcfa, icon, onSubmit, LOGO, $ } from '../ui.js';

const METHODS = [
  ['wave', 'Wave', '#1dc4ff'],
  ['orange_money', 'Orange Money', '#ff7900'],
  ['free_money', 'Free Money', '#cd0f2d'],
  ['card', 'Carte bancaire', '#2e2a6b'],
];

const label = (p) => (p.kind === 'registration' ? `Inscription — ${p.shop_name}` : `Commande ${p.order_ref} — ${p.order_title}`);
const nextUrl = (p) => (p.kind === 'registration' ? '#/boutique' : `#/commandes/${p.order_id}`);

/** Page de paiement de démonstration (PAYMENT_PROVIDER=simulation) */
export async function simulation({ app, params }) {
  const { payment: p, provider } = await api(`/payments/${encodeURIComponent(params.ref)}`);
  document.title = 'Paiement — Ñawkat';
  if (p.status !== 'pending' || provider !== 'simulation') { location.replace(`#/paiement/retour/${p.ref}`); return; }

  app.innerHTML = `<div class="container" style="max-width:520px;padding:40px 20px">
    <div class="card"><div class="card-body stack">
      <div class="row between"><span class="brand" style="font-size:1.1rem">${LOGO}<span>Ñawkat Pay</span></span><span class="badge badge-accent">Mode démonstration</span></div>
      <div style="padding:16px;background:var(--bg);border-radius:12px">
        <div class="small muted">${esc(label(p))}</div>
        <div style="font-family:var(--display);font-size:2.2rem;font-weight:600">${fcfa(p.amount)}</div>
        <div class="xs muted">Réf. ${esc(p.ref)}</div>
      </div>
      <form id="f" class="stack"><div class="form-error hidden"></div>
        <div class="field"><span>Moyen de paiement</span><div class="pay-methods">
          ${METHODS.map(([k, l, c], i) => `<label class="pay-method"><input type="radio" name="method" value="${k}" ${i === 0 ? 'checked' : ''}><span class="pay-logo" style="background:${c}">${l.split(' ').map((w) => w[0]).join('')}</span>${l}</label>`).join('')}
        </div></div>
        <div class="notice warn">${icon.info}<div class="small">Environnement de test : aucun argent n’est débité. En production, vous êtes redirigé vers la page sécurisée PayTech (Wave, Orange Money, Free Money, cartes).</div></div>
        <button class="btn btn-primary btn-lg btn-block" type="submit">Payer ${fcfa(p.amount)}</button>
        <button class="btn btn-ghost btn-block" type="button" id="fail">Simuler un échec</button>
      </form>
    </div></div></div>`;

  const go = async (outcome) => {
    const method = $('#f').method.value;
    await api(`/payments/${p.ref}/simulate`, { method: 'POST', body: { method, outcome } });
    location.hash = `#/paiement/retour/${p.ref}`;
  };
  onSubmit($('#f'), () => go('success'));
  $('#fail').onclick = () => go('fail');
}

/** Retour de paiement : attend la confirmation (webhook) puis redirige */
export async function result({ app, params, query, isCurrent }) {
  document.title = 'Paiement — Ñawkat';
  let tries = 0;
  const check = async () => {
    if (!isCurrent()) return;
    const { payment: p } = await api(`/payments/${encodeURIComponent(params.ref)}`);
    const view = (emoji, title, text, actions) => {
      app.innerHTML = `<div class="container" style="max-width:520px;padding:60px 20px"><div class="card card-body center stack">
        <div style="font-size:3rem">${emoji}</div><h1 style="font-size:1.7rem">${title}</h1><p class="muted">${text}</p>${actions}</div></div>`;
    };
    if (p.status === 'paid') {
      await refreshUser();
      view('✅', 'Paiement confirmé', p.kind === 'registration'
        ? 'Félicitations, votre boutique est en ligne ! Ajoutez vos prestations et vos plus belles photos.'
        : `${fcfa(p.amount)} payés. Les fonds sont sécurisés par Ñawkat jusqu’à la réception de votre tenue.`,
      `<a class="btn btn-primary" href="${nextUrl(p)}">Continuer</a>`);
    } else if (p.status === 'failed' || query.annule) {
      view('❌', 'Paiement non abouti', 'Aucun montant n’a été débité. Vous pouvez réessayer.', `<a class="btn btn-primary" href="${p.kind === 'registration' ? '#/onboarding' : nextUrl(p)}">Réessayer</a>`);
    } else if (tries++ < 20) {
      view('⏳', 'Confirmation en cours…', 'Validez le paiement sur votre téléphone si ce n’est pas encore fait. Cette page se met à jour automatiquement.', '<div class="spinner"></div>');
      setTimeout(check, 3000);
    } else {
      view('⏳', 'Paiement en attente', 'Nous n’avons pas encore reçu la confirmation. Elle apparaîtra dans votre commande dès réception.', `<a class="btn btn-outline" href="${nextUrl(p)}">Voir la commande</a>`);
    }
  };
  await check();
}
