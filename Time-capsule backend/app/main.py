from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.exceptions import AppError
from app.routers import capsules, recipients

app = FastAPI(
    title="Time Capsule API",
    version="1.0.0",
    description=(
        "Backend for the Time Capsule site: write a letter, choose an opening date, "
        "share the capsule with recipients and break the seal when the day comes."
    ),
)
# Allows the frontend running on Live Server to access the API later
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(capsules.router)
app.include_router(recipients.router)


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
    return JSONResponse(status_code=exc.status_code, content=error_body("http_error", str(exc.detail)))


@app.get("/", tags=["Meta"], summary="API status")
def root():
    return {"name": "Time Capsule API", "docs": "/docs"}
