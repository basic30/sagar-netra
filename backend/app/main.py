import os
import sys

# Critical 512MB RAM environment limits for cloud hosting (Render Free Tier)
os.environ["GDAL_CACHEMAX"] = "16"       # Cap GDAL internal block cache to 16MB
os.environ["VSI_CACHE"] = "FALSE"        # Disable GDAL virtual filesystem caching
os.environ["OMP_NUM_THREADS"] = "1"      # Restrict OpenMP thread pool to 1 thread
os.environ["MKL_NUM_THREADS"] = "1"      # Restrict MKL thread pool to 1 thread
os.environ["OPENBLAS_NUM_THREADS"] = "1" # Restrict OpenBLAS to 1 thread

try:
    import torch
    torch.set_num_threads(1)
except Exception:
    pass

import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.api.incidents import router as incidents_router
from backend.app.api.vessels import router as vessels_router
from backend.app.api.detection import router as detection_router
from backend.app.services.live_ais_service import connect_to_aisstream, get_connection_status

# AegisSpill Main FastAPI Application Entrypoint (v1.0.6)
app = FastAPI(
    title="Marine Oil Spill Detection, Drift Tracking & Vessel Attribution System API",
    version="1.0.0",
    description="End-to-end API for satellite SAR oil spill detection, drift forecasting, backward origin tracing, and explainable vessel ranking."
)

from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()] if allowed_origins_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc.detail)},
        headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*"}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid or unprocessable upload request payload.", "errors": str(exc)},
        headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*"}
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*"}
    )

app.include_router(incidents_router, prefix="/api")
app.include_router(vessels_router, prefix="/api")
app.include_router(detection_router, prefix="/api")

# Ensure static asset directories exist BEFORE mounting to avoid 404s
for d in ["outputs", "outputs/previews", "outputs/masks", "results", "data", "images"]:
    os.makedirs(d, exist_ok=True)

app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")
app.mount("/results", StaticFiles(directory="results"), name="results")
app.mount("/data", StaticFiles(directory="data"), name="data")
app.mount("/images", StaticFiles(directory="images"), name="images")

@app.on_event("startup")
async def startup_event():
    print("Starting FastAPI Backend Server...", flush=True)
    api_key = os.getenv("AISSTREAM_API_KEY", "de5c8707bb4ff474749f531e11a09a6b1e850200")
    if api_key:
        print(f"Initializing background AISstream listener with API Key: {api_key[:8]}...", flush=True)
        asyncio.create_task(connect_to_aisstream(api_key))

@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {
        "system": "Marine Oil Spill Detection, Drift Tracking & Vessel Attribution API",
        "status": "OPERATIONAL",
        "aisstream_connected": get_connection_status()["connected"],
        "docs_url": "/docs"
    }

@app.api_route("/api/status", methods=["GET", "HEAD"])
@app.api_route("/api/health", methods=["GET", "HEAD"])
def system_status():
    proj_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    ckpt_abs = os.path.join(proj_root, "ml", "checkpoints", "best_model.pth")
    checkpoint_exists = os.path.exists(ckpt_abs) or os.path.exists("ml/checkpoints/best_model.pth")
    return {
        "api_status": "ONLINE",
        "model_checkpoint_exists": checkpoint_exists,
        "aisstream_status": get_connection_status(),
        "environment": os.getenv("ENV", "development")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
