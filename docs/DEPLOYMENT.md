# Déploiement de production

Cette procédure déploie DataClair avec Docker Compose : Caddy termine HTTPS automatiquement, Nginx sert le frontend et relaie `/api` vers FastAPI. Les bases SQLite et les imports enregistrés restent dans un volume Docker.

## Prérequis

- Un serveur Linux avec Docker Engine et le plugin Docker Compose.
- Un nom de domaine dont les enregistrements DNS A/AAAA pointent vers ce serveur.
- Les ports TCP 80 et 443 accessibles depuis Internet. Le port UDP 443 est facultatif et permet HTTP/3.
- Une seule instance de l’API : SQLite n’est pas configuré pour un déploiement multi-réplicas.

## Première installation

Depuis la racine du dépôt, créez le fichier de configuration et définissez un secret aléatoire :

```sh
cp .env.production.example .env
openssl rand -hex 32
```

Modifiez `.env` : remplacez `DOMAIN` par votre domaine et `ANALYTICS_ADMIN_TOKEN` par le secret généré. Ne publiez jamais ce fichier. Configurez ensuite le DNS et démarrez les services :

```sh
docker compose up -d --build
docker compose ps
docker compose logs -f proxy api
```

Ouvrez `https://votre-domaine/`. Caddy demande et renouvelle le certificat TLS automatiquement. L’API n’est pas publiée directement sur Internet ; elle passe par le proxy du frontend sur la même origine.

## Mises à jour

Récupérez la version voulue du code puis reconstruisez les images :

```sh
docker compose up -d --build
docker compose ps
```

Ne lancez pas `docker compose down -v` : l’option `-v` supprime les volumes de données.

## Données, sauvegardes et limites

Le volume `app_data` contient les bases `app.sqlite3` et `analytics.sqlite3`, ainsi que les imports persistants des comptes. Configurez des sauvegardes chiffrées et testez leur restauration ; les volumes `caddy_data` et `caddy_config` conservent les certificats et leur état. Les rapports CSV anonymes restent temporaires. Le proxy limite le corps des requêtes à 11 Mo pour laisser la marge multipart autour de la limite applicative de 10 Mo, et limite `/api` à 5 requêtes par seconde par adresse IP avec un burst de 10.

Configurez également les journaux et leur rétention au niveau de l’hébergeur. Une instance SQLite unique est adaptée à un petit déploiement ; pour plusieurs réplicas ou un trafic important, migrez les bases vers un service de base de données adapté avant de mettre à l’échelle.

## Vérification après lancement

- `docker compose ps` indique les trois services en état `healthy` ou `running`.
- `https://votre-domaine/` sert l’application et `https://votre-domaine/api/health` répond `{"status":"ok"}`.
- Un CSV de moins de 10 Mo peut être analysé ; un fichier plus grand est refusé.
- Les cookies de consentement sont marqués `Secure` et les statistiques admin ne répondent qu’avec le token configuré.

Pour consulter les statistiques, utilisez le token de `.env` dans la page `/admin/analytics`. Pour diagnostiquer un service : `docker compose logs --tail=100 api frontend proxy`.