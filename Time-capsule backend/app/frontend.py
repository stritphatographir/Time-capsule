"""Serve the browser app without exposing the repository as a static directory."""

from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_FILES = {"index.html", "create.html", "dashboard.html", "capsule.html", "capsules.json"}

router = APIRouter(prefix="/app", include_in_schema=False)


@router.api_route("/", methods=["GET", "HEAD"])
def index():
    return FileResponse(PROJECT_ROOT / "index.html")


@router.api_route("/{filename}", methods=["GET", "HEAD"])
def frontend_file(filename: str):
    if filename not in FRONTEND_FILES:
        raise HTTPException(status_code=404, detail="Frontend file not found")
    return FileResponse(PROJECT_ROOT / filename)


def install_frontend(app: FastAPI) -> None:
    app.mount("/app/css", StaticFiles(directory=PROJECT_ROOT / "css"), name="frontend_css")
    app.mount("/app/js", StaticFiles(directory=PROJECT_ROOT / "js"), name="frontend_js")
    app.include_router(router)
