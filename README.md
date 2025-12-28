# Manifold

A full-stack deployment portal application for deploying Docker containers on VM targets.

## Architecture

- **Backend**: Python + FastAPI, managed with Poetry, containerized with Docker
- **Frontend**: React + TypeScript, managed with pnpm, containerized with Docker

## Quick Start

### Prerequisites

- Docker and Docker Compose
  - **macOS**: Install Docker Desktop (includes Compose plugin) or run `brew install docker-compose`
  - **Linux**: Install Docker Compose plugin or standalone: `sudo apt-get install docker-compose` or follow [official instructions](https://docs.docker.com/compose/install/)
- Poetry (for backend development)
- pnpm (for frontend development)
- Python 3.12+ (for backend development)
- Node.js 22+ (for frontend development)

**Note**: Make sure Docker Desktop (or Docker daemon) is running before building.

### Running with Docker Compose

1. Build and start all services:
   ```bash
   make build
   make up
   ```

   Or directly:
   ```bash
   docker compose up --build
   ```

   **Note**: If you see "Cannot connect to the Docker daemon", start Docker Desktop first.

2. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Development Mode

#### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   poetry install
   ```

3. Run the development server:
   ```bash
   make backend-dev
   ```
   
   Or directly:
   ```bash
   poetry run uvicorn deploy_portal_backend.main:app --reload --host 0.0.0.0 --port 8000
   ```

#### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run the development server:
   ```bash
   make frontend-dev
   ```
   
   Or directly:
   ```bash
   pnpm dev --port 5173
   ```

The frontend will be available at http://localhost:5173 and will proxy API requests to the backend.

### Quick Setup

Install all dependencies:
```bash
make install
```

This will install both backend (Poetry) and frontend (pnpm) dependencies.

### Testing

Run backend tests:
```bash
make test
```

Or:
```bash
cd backend && poetry run pytest
```

## Project Structure

```
.
├── backend/
│   ├── deploy_portal_backend/
│   │   ├── api/
│   │   │   ├── routes_targets.py
│   │   │   └── routes_deployments.py
│   │   ├── models/
│   │   │   ├── target.py
│   │   │   └── deployment.py
│   │   ├── core/
│   │   │   └── config.py
│   │   └── main.py
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TargetList.tsx
│   │   │   ├── TargetForm.tsx
│   │   │   └── DeploymentPanel.tsx
│   │   ├── api.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── Makefile
```

## Features

### Current Functionality

- **VM Target Management**: Create and list VM targets (IP addresses or hostnames)
- **Docker Deployment Preview**: Preview Docker container deployments before applying
- **Docker Deployment**: Deploy Docker containers to VM targets with:
  - Docker image specification (e.g., `nginx:latest`)
  - Container name
  - Optional port mappings (e.g., `8080:80`)
- **Deployment Status Tracking**: Track deployment status (queued, running, success, failed)

## Usage Example

1. **Create a VM Target**:
   - Name: `Production Server`
   - Address: `192.168.1.100`

2. **Deploy a Docker Container**:
   - Select the VM target
   - Docker Image: `nginx:latest`
   - Container Name: `web-server`
   - Port Mapping: `8080:80` (optional)
   - Click "Preview" to see what will be deployed
   - Click "Deploy" to queue the deployment

### Future Enhancements

- Real SSH-based Docker deployment execution
- Persistent storage (database) for targets and deployments
- Authentication and authorization
- Deployment history and logs
- Real-time deployment status updates
- Environment variables and volume mounts configuration
- Container health checks

## API Endpoints

### Targets

- `GET /api/targets` - List all VM targets
- `POST /api/targets` - Create a new VM target
  ```json
  {
    "name": "Production Server",
    "address": "192.168.1.100"
  }
  ```
- `GET /api/targets/{target_id}` - Get a specific target

### Deployments

- `GET /api/deployments` - List all deployments
- `POST /api/deployments/preview` - Preview a Docker deployment
  ```json
  {
    "target_id": 1,
    "image": "nginx:latest",
    "container_name": "my-nginx",
    "ports": "8080:80"
  }
  ```
- `POST /api/deployments/apply` - Apply a Docker deployment (same request body as preview)

## Environment Variables

### Backend

- `API_PREFIX` - API prefix path (default: `/api`)
- `PROJECT_NAME` - Project name (default: `Deploy Portal`)

### Frontend

- `VITE_API_BASE` - Backend API base URL (default: `http://localhost:8000/api`)

## Makefile Commands

### Development
- `make install` - Install all dependencies (backend + frontend)
- `make install-backend` - Install backend dependencies (Poetry)
- `make install-frontend` - Install frontend dependencies (pnpm)
- `make backend-dev` - Run backend in development mode (port 8000)
- `make frontend-dev` - Run frontend in development mode (port 5173)

### Docker Compose
- `make build` - Build Docker images
- `make up` - Start services in detached mode
- `make down` - Stop services
- `make logs` - View logs from all services
- `make restart` - Restart all services
- `make clean` - Remove containers, volumes, and images

### Testing
- `make test` - Run backend tests

Run `make help` to see all available commands.

## License

See LICENSE file for details.
