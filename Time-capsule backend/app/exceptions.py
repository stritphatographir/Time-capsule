"""Сервисы сообщают об ошибках через эти исключения. Ответ клиенту собирает main.py."""

class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class CapsuleNotFoundError(AppError):
    status_code = 404
    code = "capsule_not_found"


class RecipientNotFoundError(AppError):
    status_code = 404
    code = "recipient_not_found"


class InvalidOpenDateError(AppError):
    status_code = 400
    code = "invalid_open_date"


class CapsuleLockedError(AppError):
    status_code = 403
    code = "capsule_locked"


class AlreadyOpenedError(AppError):
    status_code = 409
    code = "already_opened"


class CapsuleNotEditableError(AppError):
    status_code = 409
    code = "capsule_not_editable"


class DuplicateRecipientError(AppError):
    status_code = 409
    code = "duplicate_recipient"


class RecipientLimitError(AppError):
    status_code = 409
    code = "recipient_limit_reached"


class MusicSearchUnavailableError(AppError):
    status_code = 502
    code = "music_search_unavailable"


class NoteLimitError(AppError):
    status_code = 409
    code = "note_limit_reached"
