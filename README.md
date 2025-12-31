# Manifold

A deployment portal for managing Docker containers on remote VM targets via SSH.

## Architecture

- **Backend**: Python + FastAPI (Poetry)
- **Frontend**: React + TypeScript (pnpm)
- **Deployment**: Docker Compose

## Prerequisites

- Docker Desktop (or Docker + Docker Compose)
- Poetry (for backend development)
- pnpm (for frontend development)

## Quick Start

### Using Docker Compose

1. Build and start all services:
   ```bash
   make build
   make up
   ```

   Or directly:
   ```bash
   docker compose up --build
   ```

2. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Development Mode

**Backend:**
```bash
cd backend
poetry install
make backend-dev
```

**Frontend:**
```bash
cd frontend
pnpm install
make frontend-dev
```

The frontend will be available at http://localhost:5173.

## Usage

1. **Create a VM Target**: Add a target with SSH credentials (IP address, SSH key path, username)
2. **Deploy Containers**: Deploy Docker containers or Docker Compose stacks to your targets
3. **Manage Containers**: View logs, manage environment variables for containers and VM instances

## Features

- VM target management with SSH authentication
- Docker container deployment (single containers or Docker Compose)
- Container log viewing
- Environment variable management (containers and VM instances)
- Real-time deployment status tracking
- Dark mode support

## Makefile Commands

- `make build` - Build Docker images
- `make up` - Start services
- `make down` - Stop services
- `make logs` - View logs
- `make install` - Install all dependencies
- `make test` - Run backend tests

Run `make help` for all available commands.

## License

See LICENSE file for details.
