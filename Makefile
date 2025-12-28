.PHONY: help backend-dev frontend-dev build up down clean test check-docker-compose

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
	@echo "Available commands:"
	@echo "  make backend-dev    - Run backend in development mode"
	@echo "  make frontend-dev   - Run frontend in development mode"
	@echo "  make build          - Build Docker images"
	@echo "  make up             - Start services with Docker Compose"
	@echo "  make down           - Stop services"
	@echo "  make clean          - Remove containers and volumes"
	@echo "  make test           - Run backend tests"

backend-dev:
	cd backend && poetry run uvicorn deploy_portal_backend.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev:
	cd frontend && pnpm dev --port 5173

build: check-docker-compose
	$(DOCKER_COMPOSE) build

up: check-docker-compose
	$(DOCKER_COMPOSE) up -d

down: check-docker-compose
	$(DOCKER_COMPOSE) down

clean: check-docker-compose
	$(DOCKER_COMPOSE) down -v
	$(DOCKER_COMPOSE) rm -f

test:
	cd backend && poetry run pytest
