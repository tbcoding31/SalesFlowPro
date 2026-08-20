# SalesFlow Pro

Enterprise Multi-Tenant Sales CRM and Activity Management Application

## Development

The project is built with React/Vite (Frontend) and Node.js/Express (Backend).

### Prerequisites
- Node.js 24.18.0
- MySQL 8+

### Setup
1. Copy `.env.example` to `.env` in the root (for frontend) and `.env` in `backend/` (for backend)
2. Run `npm install` in the root
3. Run `cd backend && npm install`
4. Create the MySQL database

### Running Locally
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
npm run dev
```

## Production Docker Deployment

This project uses Docker and Docker Compose for production deployment, and GitHub Actions for CI/CD.

### Architecture
- **Frontend**: Nginx Alpine serving React static build on port 3100.
- **Backend**: Node Alpine running Express API on port 5000.
- **Proxy**: Nginx proxies `/api/*` requests to the internal backend container.

### Deploying Manually
```bash
# Build and start services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

### Automated CI/CD (GitHub Actions)
The repository is configured to automatically build and push Docker images to GitHub Container Registry (GHCR) on every push to the `main` branch.

To deploy the latest changes to the production server:
1. Ensure the server has pulled the latest `docker-compose.yml` and `docker-compose.prod.yml`
2. Run the deployment script with the latest commit SHA:
   ```bash
   ./deploy.sh <COMMIT_SHA>
   ```

### Secrets & Environment Variables
- **Frontend**: Variables prefixed with `VITE_` in the root `.env` are baked into the build and are PUBLIC.
- **Backend**: Variables in `backend/.env` (like `DB_PASSWORD`) are SECRET and must only reside on the production server.
