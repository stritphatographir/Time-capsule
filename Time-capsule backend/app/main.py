from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.exceptions import AppError
from app.frontend import install_frontend
from app.routers import capsules, recipients, songs

app = FastAPI(
    title="Time Capsule API",
    version="1.0.0",
    description=(
        "Backend for the Time Capsule site: write a letter, choose an opening date, "
        "share the capsule with recipients and break the seal when the day comes."
    ),
)
# Keep the separate local frontend available for Live Server development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Location"],
)

app.include_router(capsules.router)
app.include_router(recipients.router)
app.include_router(songs.router)
install_frontend(app)


@app.middleware("http")
async def prevent_capsule_caching(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path == "/capsules" or path.startswith("/capsules/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def error_body(code: str, message: str, fields: list[dict] | None = None) -> dict:
    body = {"code": code, "message": message}
    if fields:
        body["fields"] = fields
    return {"error": body}


@app.exception_handler(AppError)
async def handle_app_error(request: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content=error_body(exc.code, exc.message))


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError):
    fields = [
        {"field": ".".join(str(part) for part in e["loc"]), "message": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content=error_body("validation_error", "The request is not valid.", fields),
    )


@app.exception_handler(StarletteHTTPException)
async def handle_http_error(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body("http_error", str(exc.detail)),
        headers=exc.headers,
    )


@app.get("/", tags=["Meta"], summary="API status")
def root():
    return {"name": "Time Capsule API", "docs": "/docs"}


class HealthResponse(BaseModel):
    status: Literal["ok"]


@app.get("/healthz", tags=["Meta"], summary="Health check")
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")
