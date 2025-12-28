FROM python:3.12-slim

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Poetry
RUN pip install poetry==1.7.1

# Configure Poetry: Don't create virtual env, install dependencies directly
RUN poetry config virtualenvs.create false

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Install dependencies (without dev dependencies)
RUN poetry install --no-dev --no-interaction --no-ansi

# Copy application code
COPY deploy_portal_backend ./deploy_portal_backend

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "deploy_portal_backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

