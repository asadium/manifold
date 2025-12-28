# Deploy Portal

A full-stack deployment portal application for managing deployment targets (Kubernetes clusters and VMs).

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

### Running with Docker Compose

1. Build and start all services:
   ```bash
   make build
   make up
   ```

   Or directly:
   ```bash
   docker-compose up --build
   ```

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

- **Target Management**: Create and list deployment targets (Kubernetes clusters or VMs)
- **Deployment Preview**: Preview deployments (stub implementation)
- **Deployment Apply**: Queue deployments (stub implementation)

### Future Enhancements

- Real Kubernetes API integration
- SSH-based VM deployment
- Persistent storage (database)
- Authentication and authorization
- Deployment history and logs
- Real-time deployment status updates

## API Endpoints

### Targets

- `GET /api/targets` - List all targets
- `POST /api/targets` - Create a new target
- `GET /api/targets/{target_id}` - Get a specific target

### Deployments

- `GET /api/deployments` - List all deployments
- `POST /api/deployments/preview` - Preview a deployment
- `POST /api/deployments/apply` - Apply a deployment

## Environment Variables

### Backend

- `API_PREFIX` - API prefix path (default: `/api`)
- `PROJECT_NAME` - Project name (default: `Deploy Portal`)

### Frontend

- `VITE_API_BASE` - Backend API base URL (default: `http://localhost:8000/api`)

## Makefile Commands

- `make backend-dev` - Run backend in development mode
- `make frontend-dev` - Run frontend in development mode
- `make build` - Build Docker images
- `make up` - Start services with Docker Compose
- `make down` - Stop services
- `make clean` - Remove containers and volumes
- `make test` - Run backend tests

## License

See LICENSE file for details.
