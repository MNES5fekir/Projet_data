/**
 * Données de démonstration : `npm run seed` (réinitialise la base).
 * Comptes : voir README.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

for (const f of [config.dbFile, `${config.dbFile}-wal`, `${config.dbFile}-shm`]) fs.rmSync(f, { force: true });

const { db, run, get } = await import('./db.js');
const { hashPassword } = await import('./auth.js');
const { recomputeTailor } = await import('./scoring.js');
const { genRef } = await import('./util.js');

// ---------- Visuels SVG générés (tissus et silhouettes) ----------
const demoDir = path.join(config.uploadDir, 'demo');
fs.rmSync(demoDir, { recursive: true, force: true });
fs.mkdirSync(demoDir, { recursive: true });

const SHAPES = {
  boubou: 'M200 70 L262 78 L384 160 L362 238 L300 206 L312 470 L88 470 L100 206 L38 238 L16 160 L138 78 Z',
  robe: 'M168 70 L232 70 L254 128 L236 206 L306 470 L94 470 L164 206 L146 128 Z',
  costume: 'M150 70 L250 70 L330 110 L350 330 L300 330 L292 200 L282 470 L118 470 L108 200 L100 330 L50 330 L70 110 Z',
  ensemble: 'M160 70 L240 70 L300 110 L320 250 L280 250 L270 200 L270 280 L130 280 L130 200 L120 250 L80 250 L100 110 Z M130 290 L270 290 L290 470 L215 470 L200 330 L185 470 L110 470 Z',
};
const PATTERNS = {
  diamonds: (c) => `<path d="M12 0 24 12 12 24 0 12Z" fill="${c}" opacity=".55"/><circle cx="12" cy="12" r="3" fill="#fff" opacity=".7"/>`,
  dots: (c) => `<circle cx="6" cy="6" r="4" fill="${c}" opacity=".6"/><circle cx="18" cy="18" r="4" fill="${c}" opacity=".6"/><circle cx="18" cy="6" r="2" fill="#fff" opacity=".6"/>`,
  stripes: (c) => `<rect width="24" height="8" fill="${c}" opacity=".55"/><rect y="12" width="24" height="3" fill="#fff" opacity=".5"/>`,
  waves: (c) => `<path d="M0 12 Q6 4 12 12 T24 12" stroke="${c}" stroke-width="3" fill="none" opacity=".7"/><circle cx="12" cy="20" r="2" fill="#fff" opacity=".6"/>`,
};
const PALETTES = [
  ['#2e2a6b', '#e3a01b', '#f8ecd1'], ['#7c2d12', '#fbbf24', '#fde7cf'], ['#065f46', '#facc15', '#e6f4ea'],
  ['#831843', '#f472b6', '#fde2ef'], ['#1e3a8a', '#38bdf8', '#e0efff'], ['#3f3f46', '#e3a01b', '#f1eee8'],
  ['#9a3412', '#22c55e', '#fff1e6'], ['#4c1d95', '#f59e0b', '#efe7ff'],
];
let imgN = 0;
function garment(shape, palette, pattern) {
  const [base, accent, bg] = palette;
  const id = `p${imgN}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="800" height="1000">
<defs><pattern id="${id}" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(${(imgN * 17) % 45})"><rect width="24" height="24" fill="${base}"/>${PATTERNS[pattern](accent)}</pattern>
<radialGradient id="g${id}" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient></defs>
<rect width="400" height="500" fill="${bg}"/><ellipse cx="200" cy="482" rx="150" ry="10" fill="#000" opacity=".08"/>
<path d="${SHAPES[shape]}" fill="url(#${id})" stroke="${base}" stroke-width="3" stroke-linejoin="round"/>
<path d="${SHAPES[shape]}" fill="url(#g${id})"/>
<path d="M176 74 Q200 112 224 74" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
${shape === 'boubou' ? `<path d="M200 110 L200 240 M180 130 Q200 150 220 130 M176 160 Q200 182 224 160" stroke="${accent}" stroke-width="3" fill="none" opacity=".9"/>` : ''}
</svg>`;
  const file = `g${String(imgN++).padStart(3, '0')}.svg`;
  fs.writeFileSync(path.join(demoDir, file), svg);
  return `/uploads/demo/${file}`;
}

// ---------- Données ----------
const pw = (p) => hashPassword(p);
const userId = (role, name, phone, pass, city) =>
  Number(run('INSERT INTO users(role, full_name, phone, password_hash, city) VALUES (?, ?, ?, ?, ?)', role, name, phone, pw(pass), city).lastInsertRowid);

userId('admin', 'Équipe Ñawkat', '+221770000000', 'admin123', 'Dakar');
const clientNames = ['Awa Ndiaye', 'Moussa Diop', 'Fatou Sow', 'Ibrahima Fall', 'Aïssatou Ba', 'Cheikh Mbaye', 'Mariama Diallo', 'Ousmane Sarr', 'Khady Gueye', 'Mamadou Faye', 'Coumba Thiam', 'Pape Ndour'];
const clients = clientNames.map((n, i) => userId('client', n, `+2217611${String(i).padStart(5, '0')}`, 'client123', 'Dakar'));
const demoClient = userId('client', 'Aminata Diagne', '+221771111111', 'client123', 'Dakar');
run('UPDATE users SET measurements = ? WHERE id = ?', JSON.stringify({ poitrine: 92, taille: 74, hanches: 100, epaules: 40, longueur_manche: 58, longueur_boubou: 145 }), demoClient);

const TAILORS = [
  { name: 'Ndèye Fatou Seck', shop: 'Atelier Ndèye Couture', tag: 'Le bazin brodé dans les règles de l’art', city: 'Dakar', district: 'Médina', spec: ['Grand boubou', 'Broderie', 'Tenue de cérémonie'], aud: 'mixte', exp: 18, deliv: 1, verified: 1, quality: 4.8, late: 0.05, shape: 'boubou',
    bio: 'Formée auprès des grands brodeurs de la Médina, je réalise depuis 18 ans des grands boubous et tenues de cérémonie en bazin riche et getzner. Broderie main ou machine, finitions impeccables.' },
  { name: 'Mamadou Lamine Diouf', shop: 'Diouf Sur Mesure', tag: 'Costumes et kaftans pour hommes exigeants', city: 'Dakar', district: 'Plateau', spec: ['Costume', 'Kaftan', 'Tenue de mariage'], aud: 'homme', exp: 12, deliv: 1, verified: 1, quality: 4.6, late: 0.1, shape: 'costume',
    bio: 'Spécialiste du costume sur mesure et du kaftan moderne. Tissus importés disponibles à l’atelier. Prise de mesures à domicile sur Dakar.' },
  { name: 'Astou Ndiaye', shop: 'Astou Wax Création', tag: 'Ensembles wax modernes et colorés', city: 'Pikine', district: 'Pikine Icotaf', spec: ['Ensemble wax', 'Robe', 'Taille basse'], aud: 'femme', exp: 7, deliv: 0, verified: 1, quality: 4.5, late: 0.15, shape: 'ensemble',
    bio: 'Je crée des tenues en wax qui allient tradition et tendance : tailles basses, robes cintrées, ensembles pour le bureau ou les sorties.' },
  { name: 'Serigne Mbaye Gueye', shop: 'Gueye Tailleur Touba', tag: 'Tenues traditionnelles pour toute la famille', city: 'Touba', district: 'Darou Marnane', spec: ['Grand boubou', 'Kaftan', 'Tenue enfant'], aud: 'mixte', exp: 25, deliv: 0, verified: 0, quality: 4.3, late: 0.2, shape: 'boubou',
    bio: 'Atelier familial depuis 25 ans. Grands boubous, kaftans et tenues pour enfants, notamment pour les Magal et les fêtes religieuses.' },
  { name: 'Rokhaya Sall', shop: 'Maison Rokhaya', tag: 'Robes de soirée et tenues de mariage', city: 'Thiès', district: 'Randoulène', spec: ['Robe', 'Tenue de mariage', 'Broderie'], aud: 'femme', exp: 10, deliv: 1, verified: 1, quality: 4.9, late: 0.0, shape: 'robe',
    bio: 'Créatrice de robes de soirée et de mariage. Chaque pièce est unique, avec essayages inclus et finitions perlées à la main.' },
  { name: 'Alioune Badara Ka', shop: 'Ka Retouches Express', tag: 'Retouches rapides, uniformes et petits travaux', city: 'Guédiawaye', district: 'Golf Sud', spec: ['Retouches', 'Uniformes', 'Tenue enfant'], aud: 'mixte', exp: 6, deliv: 0, verified: 0, quality: 4.1, late: 0.25, shape: 'costume',
    bio: 'Retouches en 24 à 48 h, uniformes scolaires et professionnels à prix réduits pour les commandes groupées.' },
  { name: 'Bineta Cissé', shop: 'Bineta Taille Basse', tag: 'La taille basse sénégalaise réinventée', city: 'Saint-Louis', district: 'Sor', spec: ['Taille basse', 'Ensemble wax', 'Tenue de cérémonie'], aud: 'femme', exp: 9, deliv: 1, verified: 1, quality: 4.7, late: 0.1, shape: 'ensemble',
    bio: 'Passionnée par la taille basse, je travaille le wax, le lagos et le brodé pour des tenues élégantes, de la Tabaski aux baptêmes.' },
  { name: 'Ibou Ngom', shop: 'Ngom Couture Mbour', tag: 'Kaftans brodés et boubous légers', city: 'Mbour', district: 'Escale', spec: ['Kaftan', 'Grand boubou', 'Broderie'], aud: 'homme', exp: 4, deliv: 0, verified: 0, quality: null, late: 0, shape: 'boubou',
    bio: 'Jeune atelier dynamique à Mbour. Kaftans brodés et boubous légers à prix accessibles.' },
];

const SERVICES = {
  'Grand boubou': [['Grand boubou bazin brodé', 35000, 10], ['Grand boubou simple', 20000, 7]],
  Kaftan: [['Kaftan homme brodé', 25000, 7], ['Kaftan simple', 15000, 5]],
  'Taille basse': [['Taille basse wax', 15000, 5], ['Taille basse brodée', 25000, 8]],
  Robe: [['Robe de soirée sur mesure', 45000, 14], ['Robe cintrée wax', 18000, 6]],
  'Ensemble wax': [['Ensemble pagne & haut', 16000, 6]],
  Costume: [['Costume deux pièces sur mesure', 75000, 15]],
  'Tenue de mariage': [['Tenue de mariage complète', 120000, 21]],
  'Tenue de cérémonie': [['Tenue de baptême / Tabaski', 30000, 8]],
  Broderie: [['Broderie main sur bazin', 20000, 10]],
  'Tenue enfant': [['Ensemble enfant', 8000, 4]],
  Uniformes: [['Uniforme scolaire (par pièce)', 6000, 5]],
  Retouches: [['Ourlet / ajustement', 2000, 1], ['Retouche complète', 5000, 2]],
};

const COMMENTS = [
  'Travail impeccable, broderie magnifique. Je recommande vivement !', 'Très professionnel, tenue livrée à temps pour la Korité.',
  'Bonne qualité mais un léger retard sur la livraison.', 'Excellent rapport qualité/prix. Je reviendrai.',
  'Les finitions sont parfaites, tout le monde m’a complimenté.', 'Très à l’écoute, a bien respecté mon modèle.',
  'Un peu long mais le résultat en valait la peine.', 'Coupe parfaite, du premier coup !', null, 'Service rapide et soigné.',
  'Tenue conforme à la photo, merci beaucoup.', 'Communication fluide sur la messagerie, très rassurant.',
];

const rnd = (() => { let s = 42; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const pick = (a) => a[Math.floor(rnd() * a.length)];
const clamp = (v) => Math.max(1, Math.min(5, Math.round(v)));
const sqlDate = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
const day = (d) => d.toISOString().slice(0, 10);
const DAY = 86400000;

let tailorPhone = 2222222;
TAILORS.forEach((T, ti) => {
  const uid = userId('tailor', T.name, ti === 0 ? '+221772222222' : `+22178${String(tailorPhone + ti).padStart(7, '0')}`, 'tailleur123', T.city);
  const palette = PALETTES[ti % PALETTES.length];
  const tid = Number(run(
    `INSERT INTO tailors(user_id, shop_name, slug, tagline, bio, city, district, specialties, audience, years_experience, home_delivery,
       status, verified, registration_paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now', ?), datetime('now', ?))`,
    uid, T.shop, T.shop.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''),
    T.tag, T.bio, T.city, T.district, JSON.stringify(T.spec), T.aud, T.exp, T.deliv, T.verified, `-${200 - ti * 20} days`, `-${200 - ti * 20} days`,
  ).lastInsertRowid);
  run(`INSERT INTO payments(ref, user_id, kind, tailor_id, amount, provider, method, status, paid_at) VALUES (?, ?, 'registration', ?, 15000, 'simulation', ?, 'paid', datetime('now'))`,
    genRef('INS'), uid, tid, pick(['wave', 'orange_money']));

  const shapes = Object.keys(SHAPES);
  const pats = Object.keys(PATTERNS);
  run('UPDATE tailors SET cover = ? WHERE id = ?', garment(T.shape, palette, pats[ti % pats.length]), tid);

  // Prestations
  const services = [];
  for (const sp of T.spec) {
    for (const [title, price, delay] of SERVICES[sp] || []) {
      const img = garment(sp === 'Costume' || sp === 'Uniformes' ? 'costume' : sp.includes('Robe') || sp === 'Tenue de mariage' ? 'robe' : sp === 'Ensemble wax' || sp === 'Taille basse' ? 'ensemble' : 'boubou', PALETTES[(ti + services.length) % PALETTES.length], pick(pats));
      const id = Number(run('INSERT INTO services(tailor_id, title, description, category, price, delay_days, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
        tid, title, `${title} réalisé(e) sur mesure selon votre modèle. Prix indicatif hors tissu, ajusté dans le devis.`, sp, price + ti * 500, delay, img).lastInsertRowid);
      services.push({ id, title, price: price + ti * 500, delay });
    }
  }
  // Réalisations
  const captions = ['Bazin riche brodé', 'Tenue de Tabaski', 'Création sur mesure', 'Modèle réalisé pour une cliente', 'Broderie fine', 'Wax et lagos', 'Collection Korité', 'Mariage à Dakar'];
  for (let k = 0; k < 6; k++) {
    run('INSERT INTO portfolio(tailor_id, image, caption) VALUES (?, ?, ?)', tid, garment(pick(shapes), PALETTES[(ti * 3 + k) % PALETTES.length], pick(pats)), captions[(ti + k) % captions.length]);
  }

  // Historique de commandes terminées et notées
  if (T.quality != null) {
    const n = 6 + Math.floor(rnd() * 14);
    for (let k = 0; k < n; k++) {
      const s = pick(services);
      const client = pick(clients);
      const created = new Date(Date.now() - (170 - k * 8) * DAY - rnd() * DAY);
      const quoted = new Date(created.getTime() + (1 + rnd() * (T.quality > 4.5 ? 8 : 30)) * 3600000);
      const paid = new Date(quoted.getTime() + rnd() * DAY);
      const promised = new Date(paid.getTime() + s.delay * DAY);
      const isLate = rnd() < T.late;
      const ready = new Date(promised.getTime() + (isLate ? (1 + rnd() * 4) * DAY : -rnd() * 2 * DAY));
      const completed = new Date(ready.getTime() + rnd() * 2 * DAY);
      const amount = Math.round((s.price * (1 + rnd() * 0.4)) / 500) * 500;
      const oid = Number(run(
        `INSERT INTO orders(ref, client_id, tailor_id, service_id, title, description, status, quote_amount, promised_date, commission_rate,
           commission_amount, created_at, quoted_at, paid_at, started_at, ready_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, 0.1, ?, ?, ?, ?, ?, ?, ?)`,
        genRef('CMD'), client, tid, s.id, s.title, 'Modèle selon photo envoyée, couleurs à confirmer.', amount, day(promised),
        Math.round(amount * 0.1), sqlDate(created), sqlDate(quoted), sqlDate(paid), sqlDate(paid), sqlDate(ready), sqlDate(completed)).lastInsertRowid);
      run(`INSERT INTO payments(ref, user_id, kind, order_id, tailor_id, amount, provider, method, status, paid_at, created_at)
           VALUES (?, ?, 'order', ?, ?, ?, 'simulation', ?, 'paid', ?, ?)`, genRef('PAY'), client, oid, tid, amount, pick(['wave', 'orange_money', 'free_money']), sqlDate(paid), sqlDate(paid));
      if (rnd() < 0.85) {
        const q = T.quality + (rnd() - 0.5);
        run(`INSERT INTO reviews(order_id, tailor_id, client_id, quality, punctuality, communication, value, comment, created_at, tailor_reply)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          oid, tid, client, clamp(q), clamp(isLate ? q - 1.8 : q + 0.2), clamp(q + (rnd() - 0.5)), clamp(q + (rnd() - 0.6)),
          pick(COMMENTS), sqlDate(completed), rnd() < 0.3 ? 'Merci beaucoup pour votre confiance, au plaisir de vous habiller à nouveau !' : null);
      }
    }
  }
  recomputeTailor(tid);
});

// Commandes en cours pour le compte client de démonstration
const t1 = get(`SELECT id FROM tailors WHERE slug = 'atelier-ndeye-couture'`).id;
const t5 = get(`SELECT id FROM tailors WHERE slug = 'maison-rokhaya'`).id;
const conv = (c, t) => Number(run('INSERT OR IGNORE INTO conversations(client_id, tailor_id) VALUES (?, ?)', c, t).lastInsertRowid)
  || get('SELECT id FROM conversations WHERE client_id = ? AND tailor_id = ?', c, t).id;

const o1 = Number(run(
  `INSERT INTO orders(ref, client_id, tailor_id, title, description, model_image, status, quote_amount, quote_note, promised_date,
     commission_rate, commission_amount, desired_date, created_at, quoted_at)
   VALUES (?, ?, ?, 'Grand boubou bazin pour la Tabaski', 'Bazin getzner bleu nuit, broderie dorée au col et sur la poitrine, manches longues.', ?,
     'quoted', 42000, 'Broderie dorée incluse. Essayage possible 3 jours avant.', date('now', '+12 days'), 0.1, 4200, date('now', '+14 days'),
     datetime('now', '-1 day'), datetime('now', '-20 hours'))`,
  genRef('CMD'), demoClient, t1, garment('boubou', PALETTES[0], 'diamonds')).lastInsertRowid);
const c1 = conv(demoClient, t1);
run(`INSERT INTO messages(conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, datetime('now', '-26 hours'))`, c1, demoClient,
  'Bonjour, je voudrais un grand boubou en bazin pour la Tabaski. Est-ce possible en moins de deux semaines ?');
const tailorUser = get('SELECT user_id FROM tailors WHERE id = ?', t1).user_id;
run(`INSERT INTO messages(conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, datetime('now', '-25 hours'))`, c1, tailorUser,
  'Bonjour ! Oui sans problème. Envoyez-moi la photo du modèle via une demande de commande et je vous fais un devis.');
run(`INSERT INTO messages(conversation_id, body, order_id, kind, created_at) VALUES (?, ?, ?, 'system', datetime('now', '-20 hours'))`, c1,
  '📋 Devis envoyé : 42 000 FCFA — tenue prête dans 12 jours.', o1);
run(`INSERT INTO order_events(order_id, actor_id, type, note, created_at) VALUES (?, ?, 'requested', 'Demande de confection envoyée.', datetime('now', '-1 day')),
     (?, ?, 'quoted', 'Devis : 42 000 FCFA. Broderie dorée incluse.', datetime('now', '-20 hours'))`, o1, demoClient, o1, tailorUser);

const o2 = Number(run(
  `INSERT INTO orders(ref, client_id, tailor_id, title, description, status, quote_amount, promised_date, commission_rate, commission_amount,
     created_at, quoted_at, paid_at, started_at)
   VALUES (?, ?, ?, 'Robe de soirée pour un mariage', 'Robe longue fluide couleur émeraude, dos ouvert, perles au col.', 'in_progress', 55000,
     date('now', '+5 days'), 0.1, 5500, datetime('now', '-9 days'), datetime('now', '-9 days', '+3 hours'), datetime('now', '-8 days'), datetime('now', '-7 days'))`,
  genRef('CMD'), demoClient, t5).lastInsertRowid);
conv(demoClient, t5);
run(`INSERT INTO payments(ref, user_id, kind, order_id, tailor_id, amount, provider, method, status, paid_at) VALUES (?, ?, 'order', ?, ?, 55000, 'simulation', 'wave', 'paid', datetime('now', '-8 days'))`,
  genRef('PAY'), demoClient, o2, t5);
run(`INSERT INTO order_events(order_id, actor_id, type, note, created_at) VALUES (?, ?, 'requested', 'Demande de confection envoyée.', datetime('now', '-9 days')),
     (?, NULL, 'paid', 'Paiement de 55 000 FCFA reçu — fonds sécurisés par Ñawkat.', datetime('now', '-8 days')),
     (?, NULL, 'in_progress', '✂️ La confection a commencé.', datetime('now', '-7 days'))`, o2, demoClient, o2, o2);

// Une demande à traiter pour le compte tailleur de démonstration
const o3 = Number(run(
  `INSERT INTO orders(ref, client_id, tailor_id, title, description, status, desired_date, measurements, created_at)
   VALUES (?, ?, ?, 'Kaftan brodé pour le baptême', 'Kaftan blanc cassé avec broderie ton sur ton, col mao.', 'requested', date('now', '+10 days'), ?, datetime('now', '-2 hours'))`,
  genRef('CMD'), clients[1], t1, JSON.stringify({ poitrine: 104, epaules: 46, longueur_manche: 63, longueur_boubou: 120 })).lastInsertRowid);
run(`INSERT INTO order_events(order_id, actor_id, type, note, created_at) VALUES (?, ?, 'requested', 'Demande de confection envoyée.', datetime('now', '-2 hours'))`, o3, clients[1]);
run(`INSERT INTO messages(conversation_id, body, order_id, kind, created_at) VALUES (?, ?, ?, 'system', datetime('now', '-2 hours'))`, conv(clients[1], t1),
  '🧵 Nouvelle demande : « Kaftan brodé pour le baptême ». Le tailleur va vous envoyer un devis.', o3);

for (const t of db.prepare('SELECT id FROM tailors').all()) recomputeTailor(t.id);
console.log(`Base de démonstration créée : ${get('SELECT COUNT(*) n FROM tailors').n} tailleurs, ${get('SELECT COUNT(*) n FROM orders').n} commandes, ${get('SELECT COUNT(*) n FROM reviews').n} avis, ${imgN} visuels.`);
