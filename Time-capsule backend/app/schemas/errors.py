from pydantic import BaseModel


class FieldError(BaseModel):
    field: str
    message: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    fields: list[FieldError] | None = None


class ErrorResponse(BaseModel):
  #Unified format for all API errors
    error: ErrorDetail
