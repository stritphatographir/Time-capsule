"""In-memory data storage for capsules and recipients.
Two "tables" are connected through capsule_id:
    capsules   : capsule ID    -> dictionary containing capsule data
    recipients : recipient ID  -> dictionary containing capsule_id
All data is cleared when the server restarts.
"""
from typing import Any

capsules: dict[int, dict[str, Any]] = {}
recipients: dict[int, dict[str, Any]] = {}

_counters = {"capsule": 0, "recipient": 0}


def next_id(kind: str) -> int:
    """Выдаёт следующий свободный id: 1, 2, 3..."""
    _counters[kind] += 1
    return _counters[kind]


def recipients_of(capsule_id: int) -> list[dict[str, Any]]:
    """Все получатели одной капсулы."""
    return [r for r in recipients.values() if r["capsule_id"] == capsule_id]


def reset() -> None:
    """Полностью очищает данные (нужно тестам)."""
    capsules.clear()
    recipients.clear()
    _counters.update(capsule=0, recipient=0)
