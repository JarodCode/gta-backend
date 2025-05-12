# GameBoxd Backend

Backend du projet GameBoxd, un site web de type Letterboxd pour les jeux vidéo.
Cette API est développée en Deno sans framework.

## Fonctionnalités

- API REST pour gérer :
  - Les utilisateurs
  - Les jeux
  - Les critiques
  - Les listes personnalisées
- Serveur HTTP en Deno
- Fichiers de données ou base de données selon les besoins

## Lancement du serveur

1. Cloner le dépôt :
   ```bash
   git clone https://github.com/ton-utilisateur/gameboxd-backend.git
   ```

2. Lancer le serveur :
   ```bash
   deno run --allow-net --allow-read --allow-write server.ts
   ```

## Arborescence du projet

- `server.ts` — Point d'entrée principal du serveur
- `routes/` — Handlers pour les différentes routes API
- `controllers/` — Logique métier
- `models/` — Définition des types ou accès aux données
- `data/` — Fichiers JSON ou autres sources de données

## À venir

- Authentification JWT
- Séparation des rôles (admin/utilisateur)
- Connexion à une vraie base de données (SQLite, PostgreSQL...)


