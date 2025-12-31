.PHONY: help install install-backend install-frontend backend-dev frontend-dev build up down logs restart clean test check-docker-compose

# Docker Compose command - tries docker compose first, falls back to docker-compose
# Override with: make build DOCKER_COMPOSE=docker-compose
DOCKER_COMPOSE := $(shell if docker compose version >/dev/null 2>&1; then echo "docker compose"; elif command -v docker-compose >/dev/null 2>&1; then echo "docker-compose"; else echo ""; fi)

check-docker-compose:
	@if [ -z "$(DOCKER_COMPOSE)" ]; then \
		echo "ERROR: Docker Compose not found!"; \
		echo ""; \
		echo "Please install Docker Compose:"; \
		echo "  macOS: brew install docker-compose"; \
		echo "  OR install Docker Desktop (includes compose plugin)"; \
		echo ""; \
		exit 1; \
	fi

help:
	@echo "Manifold - Docker Container Deployment on VMs"
	@echo ""
	@echo "Development:"
	@echo "  make install           - Install all dependencies (backend + frontend)"
	@echo "  make install-backend   - Install backend dependencies (Poetry)"
	@echo "  make install-frontend  - Install frontend dependencies (pnpm)"
	@echo "  make backend-dev       - Run backend in development mode (port 8000)"
	@echo "  make frontend-dev      - Run frontend in development mode (port 5173)"
	@echo ""
	@echo "Docker Compose:"
	@echo "  make build             - Build Docker images"
	@echo "  make up                - Start services in detached mode"
	@echo "  make down              - Stop services"
	@echo "  make logs              - View logs from all services"
	@echo "  make restart           - Restart all services"
	@echo "  make clean             - Remove containers, volumes, and images"
	@echo ""
	@echo "Testing:"
	@echo "  make test              - Run backend tests"
	@echo ""

install: install-backend install-frontend

install-backend:
	@echo "Installing backend dependencies..."
	cd backend && poetry install

install-frontend:
	@echo "Installing frontend dependencies..."
	cd frontend && pnpm install

backend-dev:
	@echo "Starting backend development server on http://localhost:8000"
	cd backend && poetry run uvicorn deploy_portal_backend.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev:
	@echo "Starting frontend development server on http://localhost:5173"
	cd frontend && pnpm dev --port 5173

build: check-docker-compose
	@echo "Building Docker images..."
	$(DOCKER_COMPOSE) build

up: check-docker-compose
	@echo "Starting services..."
	$(DOCKER_COMPOSE) up -d
	@echo ""
	@echo "Services started:"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend API: http://localhost:8000"
	@echo "  API Docs: http://localhost:8000/docs"

down: check-docker-compose
	@echo "Stopping services..."
	$(DOCKER_COMPOSE) down

logs: check-docker-compose
	$(DOCKER_COMPOSE) logs -f

restart: check-docker-compose
	@echo "Restarting services..."
	$(DOCKER_COMPOSE) restart

clean: check-docker-compose
	@echo "Cleaning up containers, volumes, and images..."
	$(DOCKER_COMPOSE) down -v --rmi local

test:
	@echo "Running backend tests..."
	cd backend && poetry run pytest
