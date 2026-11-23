# Ñawkat — tailleurs et particuliers au Sénégal

« Ñawkat » veut dire *couturier* en wolof. La plateforme met en relation les particuliers et les tailleurs ou couturières du Sénégal :

- **Tailleurs** : ils s'inscrivent, paient des frais d'inscription (15 000 FCFA par défaut) et ont une boutique en ligne (prestations, prix, photos, présentation). Ils reçoivent des demandes, envoient des devis, suivent leurs commandes et retirent leurs gains sur Wave, Orange Money ou Free Money.
- **Particuliers** : ils parcourent les tailleurs (filtres par ville, spécialité, budget, note), contactent un tailleur, envoient leur modèle (photo, description, mensurations), acceptent le devis et paient sur le site.
- **Paiement sécurisé (séquestre)** : l'argent est conservé par la plateforme et versé au tailleur à la confirmation de réception, moins la commission (10 % par défaut). Le client peut ouvrir un litige, que l'administration arbitre.
- **Notation** : la note sur 5 combine les avis clients (qualité, respect des délais, communication, rapport qualité/prix) et des indicateurs mesurés par la plateforme (ponctualité réelle, réactivité, fiabilité). Le classement utilise une moyenne bayésienne. Détail dans `server/scoring.js`.
- **Application installable (PWA)** : sur Android/iPhone, « Ajouter à l'écran d'accueil ». L'API REST est prête pour une future application mobile native.

## Démarrage

Node.js 22.13 ou plus récent (SQLite intégré, aucune base à installer).

```bash
npm install
npm run seed   # données de démonstration (efface la base)
npm start      # http://localhost:3000
npm test       # test de bout en bout du parcours complet
```

### Comptes de démonstration (créés par `npm run seed`)

| Rôle | Téléphone | Mot de passe |
|---|---|---|
| Client | 77 111 11 11 | client123 |
| Tailleur (Atelier Ndèye Couture) | 77 222 22 22 | tailleur123 |
| Administrateur | 77 000 00 00 | admin123 |

En mode `PAYMENT_PROVIDER=simulation`, une page de paiement fictive remplace la vraie passerelle : aucun argent n'est débité.

## Mise en production

1. Ouvrir un compte marchand sur **PayTech** (paytech.sn) pour encaisser Wave, Orange Money, Free Money et les cartes. Récupérer `API_KEY` / `API_SECRET`.
2. Copier `.env.example` en `.env` et le remplir (`JWT_SECRET`, clés PayTech, `PUBLIC_URL` en **https**).
3. Le webhook de confirmation est `POST {PUBLIC_URL}/api/payments/ipn/paytech`. Il doit être joignable publiquement : c'est la seule source qui valide un paiement réel.
4. Servir derrière un reverse proxy HTTPS (Caddy ou Nginx) et sauvegarder chaque jour `data/` et `uploads/`.

Le serveur refuse de démarrer en production sans `JWT_SECRET` solide ou avec le mode simulation.

## Architecture

```
server/
  app.js            Express : sécurité (CSP, en-têtes), routes, gestion des erreurs
  db.js             schéma SQLite (node:sqlite) + paramètres
  auth.js           scrypt + jetons JWT HS256, rôles client / tailor / admin
  payments.js       passerelle de paiement (simulation, PayTech) + confirmation idempotente
  scoring.js        calcul de la note et du classement
  routes/           auth, tailors (public), shop (espace tailleur), orders, messages, payments, admin
public/             interface web (SPA sans build), manifest + service worker (PWA)
tests/              test de bout en bout (node:test)
```

**Cycle d'une commande** : `requested` → `quoted` (devis) → `paid` (séquestre) → `in_progress` → `ready` → `completed` (fonds versés au tailleur, avis possible). Autres issues possibles : `declined`, `cancelled`, `disputed`, `refunded`. Une commande « prête » est clôturée automatiquement après 7 jours sans réclamation.

**Sécurité** : mots de passe hachés (scrypt), limitation des tentatives de connexion, montants toujours calculés côté serveur, signature vérifiée sur le webhook PayTech, vérification binaire des images envoyées, numéros et emails masqués dans la messagerie (pour que paiements et échanges restent sur la plateforme), numéro du client visible par le tailleur seulement après paiement.

## Pistes pour la suite

- Notifications SMS / WhatsApp (nouvelle demande, devis, tenue prête) via un fournisseur local
- Application mobile native (React Native / Flutter) branchée sur l'API existante
- Versement automatique des gains (API de décaissement Wave / PayTech)
- Vérification d'identité des tailleurs (pièce d'identité) avant d'obtenir le badge « Vérifié »
- Hébergement des images sur un stockage objet + CDN
