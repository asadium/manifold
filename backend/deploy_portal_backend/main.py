from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from deploy_portal_backend.core.config import API_PREFIX, PROJECT_NAME
from deploy_portal_backend.api.routes_targets import router as targets_router
from deploy_portal_backend.api.routes_deployments import router as deployments_router

app = FastAPI(title=PROJECT_NAME)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(targets_router, prefix=API_PREFIX)
app.include_router(deployments_router, prefix=API_PREFIX)


@app.get("/")
async def root():
    return {"message": "Deploy Portal API", "version": "0.1.0"}

