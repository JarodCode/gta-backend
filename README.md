# GameTrackr Backend

Backend du projet GameTrackr, une plateforme de type Letterboxd pour les jeux vidéo. Cette API est développée avec Deno et utilise une architecture modulaire.

## Fonctionnalités

- API REST complète pour gérer :
  - Authentification des utilisateurs (inscription, connexion)
  - Catalogue de jeux vidéo
  - Système de notation et critiques
- Sécurité avec JWT (JSON Web Tokens)
- Base de données SQLite

## Prérequis

- [Deno](https://deno.land/) v1.44 ou supérieur
- Accès en lecture/écriture au système de fichiers pour la base de données SQLite

## Installation

1. Cloner le dépôt :
   ```bash
   git clone https://github.com/votre-utilisateur/gametrackr-backend.git
   cd gametrackr-backend
   ```

2. Copier le fichier d'environnement exemple :
   ```bash
   cp .env.example .env
   ```

3. Configurer les variables d'environnement dans le fichier `.env`

## Lancement du serveur

### Mode développement

```bash
deno task dev
```

### Mode production

```bash
deno task start
```

## Structure du projet

- `src/` — Code source principal
  - `controllers/` — Contrôleurs pour la logique métier
  - `middleware/` — Middleware d'authentification et validation
  - `models/` — Modèles de données et accès à la base de données
  - `routes/` — Définition des routes API
  - `utils/` — Utilitaires et fonctions d'aide
- `database/` — Fichiers de base de données et migrations
- `data/` — Données statiques et fichiers de configuration

## API Endpoints

### Authentification
- `POST /api/auth/register` — Inscription d'un nouvel utilisateur
- `POST /api/auth/login` — Connexion d'un utilisateur
- `GET /api/auth/me` — Récupération des informations de l'utilisateur connecté

### Jeux
- `GET /api/games` — Liste des jeux
- `GET /api/games/:id` — Détails d'un jeu spécifique
- `GET /api/games/:id/reviews` — Critiques d'un jeu spécifique

### Critiques
- `POST /api/reviews` — Création d'une critique
- `PUT /api/reviews/:id` — Mise à jour d'une critique
- `DELETE /api/reviews/:id` — Suppression d'une critique

## Développement

### Tests
```bash
deno task test
```

### Linting
```bash
deno task lint
```

### Formatage du code
```bash
deno task fmt
```



