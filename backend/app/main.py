"""
Conseal Trust — FastAPI backend for PII detection and explainability.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .routes.analyze import router as analyze_router
from .routes.export import router as export_router

app = FastAPI(
    title="Conseal Trust API",
    description="PII detection and explainability engine powered by Gemini",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(export_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/ping")
async def ping():
    return {"message": "pong"}
