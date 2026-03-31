# Déploiement VPS Hetzner

## Prérequis sur le VPS

1. **Docker et Docker Compose**
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to docker group
sudo usermod -aG docker $USER
```

2. **Git** (pour cloner le repo)
```bash
sudo apt update && sudo apt install -y git
```

## Déploiement initial

```bash
# Clone le repo
git clone <your-repo-url> boulotandappartfinder
cd boulotandappartfinder

# Copier et éditer la config
cp .env.example .env
nano .env  # Configurer le proxy, les villes, etc.

# Lancer l'application
docker compose up -d --build
```

## Configuration

### Variables d'environnement (`.env`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `PROXY_URL` | URL du proxy IPRoyal | `http://user:pass@geo.iproyal.com:12321` |
| `SCRAPE_CRON` | Expression cron pour le scheduling | `0 */5 * * *` (toutes les 5h) |
| `DEFAULT_APARTMENT_CITY` | Ville par défaut pour appartements | `Bordeaux` |
| `DEFAULT_APARTMENT_MAX_PRICE` | Prix max par défaut | `1200` |
| `DEFAULT_JOB_KEYWORD` | Mot-clé emploi par défaut | `developpeur` |
| `DEFAULT_JOB_CITY` | Ville par défaut pour emplois | `Bordeaux` |

### Expressions cron courantes

- `0 */5 * * *` - Toutes les 5 heures
- `0 */3 * * *` - Toutes les 3 heures
- `0 8,14,20 * * *` - À 8h, 14h et 20h
- `0 0 * * *` - Une fois par jour à minuit

## Commandes utiles

```bash
# Voir les logs
docker compose logs -f

# Logs du backend seulement
docker compose logs -f backend

# Redémarrer
docker compose restart

# Arrêter
docker compose down

# Reconstruire et redéployer
docker compose up -d --build

# Voir l'état du scheduler
curl http://localhost/api/scheduler/status

# Déclencher un scrape manuellement
curl -X POST http://localhost/api/scheduler/trigger
```

## API Scheduler

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/scheduler/status` | GET | État du scheduler |
| `/api/scheduler/start` | POST | Démarrer le scheduler |
| `/api/scheduler/stop` | POST | Arrêter le scheduler |
| `/api/scheduler/trigger` | POST | Lancer un scrape immédiat |

## Architecture

```
┌─────────────────┐
│     Nginx       │ :80
│   (Frontend)    │
└────────┬────────┘
         │
         ▼ /api/*
┌─────────────────┐
│    Backend      │ :3000 (internal)
│  Express + API  │
│  + Scheduler    │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│SQLite │ │Proxy  │
│ (data)│ │IPRoyal│
└───────┘ └───────┘
```

## Mise à jour

```bash
cd boulotandappartfinder
./deploy.sh
```

Ou manuellement :
```bash
git pull
docker compose up -d --build
```

## Troubleshooting

### Puppeteer crash
```bash
# Vérifier les logs
docker compose logs backend | grep -i "error\|fail"

# Redémarrer le backend
docker compose restart backend
```

### Base de données corrompue
```bash
# Sauvegarder puis supprimer les données
docker compose down
docker volume rm boulotandappartfinder_backend-data
docker compose up -d
```

### Proxy ne fonctionne pas
1. Vérifier les credentials dans `.env`
2. Tester le proxy manuellement :
```bash
curl --proxy http://user:pass@geo.iproyal.com:12321 https://ipv4.icanhazip.com
```
