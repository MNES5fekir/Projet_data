# DataClair

DataClair analyse un fichier CSV sans compte. Le fichier est traité dans un répertoire temporaire et supprimé après le calcul; le navigateur conserve le rapport uniquement en mémoire tant que la page reste ouverte.

La mesure d’audience est facultative et démarre seulement après acceptation explicite. Elle compte des visiteurs pseudonymes, les sections consultées et quelques actions d’usage. Elle ne collecte ni adresse IP dans la base d’audience, ni nom de fichier, ni contenu CSV, ni identité. Refuser ne bloque aucune fonctionnalité; retirer son accord efface les événements liés au cookie pseudonyme.

## Lancer en local

Depuis la racine du projet, démarrez l’API :

```powershell
.\venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Dans un second terminal, démarrez le site :

```powershell
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5174
```

Ouvrez <http://127.0.0.1:5174>. L’API est documentée sur <http://127.0.0.1:8000/docs>.

Pour activer les statistiques administrateur en local, définissez une clé avant de démarrer l’API :

```powershell
$env:ANALYTICS_ADMIN_TOKEN = "remplacer-par-une-cle-longue-et-aleatoire"
```

Puis ouvrez <http://127.0.0.1:5174/admin/analytics> et saisissez cette clé. La page ne la conserve pas après fermeture ou actualisation. En production, définissez la variable dans les secrets du service et utilisez HTTPS.

## Utiliser l’outil

Déposez ou choisissez un fichier `.csv` de 10 Mo maximum et lancez l’analyse. Le rapport affiche le volume et la qualité des données, les distributions numériques, les catégories fréquentes, les statistiques descriptives, un nuage de points et les corrélations triées par intensité. Le bouton de téléchargement produit un rapport HTML autonome, imprimable ou enregistrable en PDF depuis le navigateur.

Les corrélations utilisent le coefficient de Pearson. Elles décrivent une association linéaire, pas une causalité. Une paire est affichée une seule fois; les colonnes constantes ou non numériques ne produisent pas de coefficient exploitable.

## Données et déploiement

Pour un déploiement Docker avec HTTPS automatique, consultez le [guide de déploiement](DEPLOYMENT.md).

L’API `POST /analysis` reçoit le champ `file` en `multipart/form-data`. Elle refuse les extensions autres que CSV et limite les imports à 10 Mo. Le CSV n’est ni enregistré dans le dossier de données applicatif, ni conservé après la requête. Le rapport téléchargé est généré dans le navigateur.

Les routes `GET /analytics/consent`, `POST /analytics/consent` et `POST /analytics/events` gèrent le consentement et les événements autorisés. `GET /analytics/summary` exige `Authorization: Bearer <ANALYTICS_ADMIN_TOKEN>`. Les événements sont purgés après 180 jours. La base `data/analytics.sqlite3` est locale et exclue de Git. L’application ne journalise pas l’adresse IP dans les statistiques; un reverse proxy peut avoir ses propres journaux d’accès à configurer séparément. Utilisez le même domaine de site pour le frontend et l’API, ou un proxy same-origin, afin que le cookie de consentement fonctionne correctement.

En cas d’hébergement public, ajoutez une limitation de débit et une limite de taille équivalente sur le reverse proxy. Les données temporaires du système peuvent subsister jusqu’à la fermeture du processus ou le nettoyage du système d’exploitation; configurez le répertoire temporaire du serveur conformément à votre politique de confidentialité.