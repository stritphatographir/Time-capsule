# Defense Prep — Assignment: PostgreSQL Integration (Time Capsule)

Graders walk the brief requirement by requirement. This document maps **each requirement →
where it lives in the code → how to prove it live → what they'll ask about it**.

## 0. The storyline (open with this, 60 seconds)

> In Assignment 5 our FastAPI backend kept capsules in an in-memory Python list — everything
> vanished on restart and there were no relationships. This assignment we moved the same
> domain into **PostgreSQL**. SQLAlchemy models describe two one-to-many relationships —
> a capsule with its recipients, and a capsule with the notes friends tuck inside it.
> Alembic migrations, committed to Git, rebuild the whole schema from scratch.
> Every endpoint now does real CRUD, and the rules of the domain — the seal, the
> 20-recipient cap, one email per capsule, no reflection before opening — are enforced in
> three layers: Pydantic schemas, service-layer business rules with row locks, and
> database constraints as the final guarantee. The app survives a full restart.

Key facts to memorize: technologies = Python, FastAPI, SQLAlchemy 2.0 (typed `Mapped`
mappings), Alembic, Pydantic v2, psycopg3 driver, PostgreSQL 17 via Docker Compose.

---

## Requirement 1 — PostgreSQL Integration

**Where it is:** `app/database.py`
- `DATABASE_URL` environment variable is the *only* way to point at the database;
  `database_url()` raises `RuntimeError` if unset and `ValueError` if the URL isn't
  PostgreSQL — fail fast, loud, at startup.
- Driver is normalized to `postgresql+psycopg` regardless of what's in the URL.
- `engine()` is `@lru_cache`-d → one engine/pool for the process; `pool_pre_ping=True`
  evicts dead connections (e.g. after the Docker container restarts).
- Other env vars: `TEST_DATABASE_URL` (tests), `POSTGRES_PASSWORD` (compose),
  `CAPSULE_MIN_LEAD_SECONDS` (demo knob). `compose.yaml` runs `postgres:17` with a
  healthcheck and a named volume.

**Live proof (30 s):** Ctrl-C uvicorn → restart → `GET /capsules/{id}` still returns the
capsule, its recipients, its notes. Name it: *"this was impossible in Assignment 5."*

**Questions:**
- *Why env vars and not hardcode?* Twelve-factor config: same image/artifact across dev,
  test, prod; secrets (the password) never enter Git.
- *What is an engine vs a Session?* Engine = pooled connection factory to Postgres, one per
  process. Session = a unit-of-work checkout of one connection, per request.
- *What does pool_pre_ping do?* Runs a lightweight ping before handing out a pooled
  connection, so a connection killed server-side doesn't blow up the first query.

## Requirement 2 — Models and Relationships

**Where it is:** `app/models.py`. Say: *"we actually have two one-to-many relationships, not one."*

```
Capsule 1 ──< N Recipient      (capsules.id → recipients.capsule_id, ON DELETE CASCADE)
Capsule 1 ──< N CapsuleNote    (capsules.id → capsule_notes.capsule_id, ON DELETE CASCADE)
```

Data types and constraints, column by column:
- Integer auto PKs; `String(100)` title, `String(5000)` message, `String(240)` prediction,
  `String(1500)` reflection, `String(254)` email (RFC 5321 max), `String(80)`/`String(600)` notes.
- `JSONB` for the song — an opaque iTunes metadata blob we store and return, never filter on.
- All timestamps `DateTime(timezone=True)` → `TIMESTAMPTZ`: one canonical instant, no DST bugs.
- 3 CHECK constraints on capsules: `open_at > created_at`;
  `opened_at IS NULL OR opened_at >= open_at` (the *seal itself*, at DB level);
  `reflection IS NULL OR opened_at IS NOT NULL`.
- CHECK on notes: signature and text non-blank after `trim()`.
- `UNIQUE (capsule_id, email)` per capsule; two composite indexes that match real queries:
  `(open_at, id)` for the list ordering, `(capsule_id, id)` for "notes in the order added".
- ORM side: `cascade="all, delete-orphan", passive_deletes=True` → Python never deletes
  children row-by-row; Postgres `ON DELETE CASCADE` does it in one statement.

**Live proof:** in `psql` (`docker compose exec db psql -U capsule -d capsules`):
`\d capsules` shows the CHECKs and indexes; try
`UPDATE capsules SET opened_at = open_at - interval '1 day' WHERE id = …` → Postgres rejects
it with `valid_seal` violated — *the rule holds even when our Python is bypassed*.

**Questions:**
- *Why put the seal rule in a CHECK if the service already checks it?* The service gives a
  friendly 403/409; the CHECK makes an inconsistent row *unrepresentable* no matter who
  writes it — defense in depth, and it's what survives concurrent writers and manual SQL.
- *Why does every String width match the Pydantic `max_length` exactly?* Pydantic rejects
  first (clean 422); Postgres would raise `StringDataRightTruncation` — matching widths mean
  the DB error is a true backstop, never a surprise.
- *Why integer PKs, not UUIDs?* Smaller FKs/indexes, simple ordering. UUIDs buy unguessable
  public URLs — relevant if capsules ever get share links.
- *Why not nullable=False everywhere it's obvious?* Postgres columns *are* NOT NULL by
  default in these models (PK, title, message, dates); only genuinely optional fields
  (opened_at, reflection, song, prediction, name) are nullable.

## Requirement 3 — Migrations with Alembic

**Where it is:** `alembic.ini` + `migrations/` (both committed to Git).
- Two revisions in `migrations/versions/`: `bbf8b390fcd2_create_capsules_and_recipients.py`
  then `847d963bf201_add_capsule_notes.py` (chained via `down_revision`).
  Story: the notes feature arrived as a *versioned schema change*, not a hand-edit.
- `migrations/env.py` imports `Base.metadata` and reuses `database_url()` from
  `app/database.py` — model and migration config share one connection source, no drift.
  Offline mode (`--sql`) can emit plain SQL for review.

**Live proof (the "recreated by applying the migrations" requirement):**
```powershell
docker compose down -v          # destroys the volume — empty database
docker compose up -d --wait
.\.venv\Scripts\python.exe -m alembic -c 'Time-capsule backend/alembic.ini' upgrade head
```
…then `psql \dt` shows `capsules`, `recipients`, `capsule_notes`, `alembic_version`.
Even better free proof: **every pytest run already does this** — each test creates a fresh
schema and runs `upgrade head` on it.

**Questions:**
- *What is in a revision file?* `upgrade()` issues `op.create_table/op.create_index…`,
  `downgrade()` reverses them; `alembic_version` table records which revision the DB is at.
- *autogenerate or hand-written?* Autogenerate drafts the diff against `Base.metadata`;
  a human reviews and commits it — never run blind (it misses some renames/types).
- *What if we edited models without migrating?* App queries fail on the missing column;
  `alembic check`/CI autogenerate-diff catches the drift.

## Requirement 4 — CRUD in the REST API

**Where it is:** `app/routers/` (capsules.py, recipients.py, songs.py) + services. Memorize this map:

| Operation | Endpoint | Notes |
| --- | --- | --- |
| Create | `POST /capsules` | 201 + `Location` header; letter/prediction/song return `null` while sealed |
| List | `GET /capsules?status=&search=&limit=&offset=` | filter sealed/ready/opened, case-insensitive title search |
| Read | `GET /capsules/{id}` | detail incl. notes once opened |
| Update | `PATCH /capsules/{id}` | only while sealed → 409 after |
| Delete | `DELETE /capsules/{id}` | 204; cascade removes recipients **and** notes |
| Children | `GET/POST /capsules/{id}/recipients`, `DELETE …/recipients/{rid}`, `POST …/notes` | the one-to-many in action |
| Domain | `POST …/open`, `PUT …/reflection`, `GET /capsules/anniversaries` | state transitions + archive |

**Live proofs, tied to the wording of the brief:**
- *"related entities handled correctly"* → create capsule + 2 recipients + 1 note →
  DELETE the capsule → GET children → gone; confirm in psql that `recipients`/`capsule_notes`
  have zero rows for that id (cascade worked).
- *"available after restarting the backend"* → the Requirement 1 restart proof.

**Questions:**
- *Why PATCH not PUT for capsules?* Partial update of a sealed capsule (title/date/song/
  prediction independently); PUT replaces whole documents — reflection is a single-field PUT
  by contrast. `CapsuleUpdate`'s model_validator rejects an empty PATCH body.
- *Why is opening a POST and not a PUT of `opened_at`?* It's a guarded state transition
  with a server-assigned timestamp; clients must not set it — that's the whole seal.
- *Where does `status` come from?* It's computed (`sealed`/`ready`/`opened`) from
  `open_at`/`opened_at` in `capsule_service.public()`, never stored — one source of truth,
  no stale status column.

## Requirement 5 — Validation & Integrity

**Where it is:** `app/schemas/` (Pydantic v2) + `app/exceptions.py` + handlers in `main.py`.

Say the three-layer sentence: **Pydantic validates shape → services enforce business rules
under row locks → Postgres constraints are the final guarantee.**

Concrete schema details you should be able to show off:
- `CamelModel` base: `alias_generator=to_camel` (API speaks `openAt`, code speaks `open_at`),
  `populate_by_name=True`, `str_strip_whitespace=True` (server-side `.trim()`).
- `RecipientCreate`: email regex pattern + `field_validator` lowercases it — so the
  duplicate check *and* the UNIQUE constraint both see one canonical form
  (`ANA@X.com` = `ana@x.com` → 409).
- `CapsuleUpdate`: `model_validator(mode="after")` enforces PATCH semantics — at least one
  field set, and required fields can't be nulled.
- Lengths mirror the DB (see Requirement 2).

Error handling taxonomy (`exceptions.py` → `main.py` renders one envelope
`{"error":{"code","message","fields"}}`):

| Situation | Code |
| --- | --- |
| past / too-soon / too-far opening date | 400 `invalid_open_date` |
| malformed request, empty PATCH | 422 `validation_error` + per-field list |
| open before the date, reflection before open | 403 `capsule_locked` |
| unknown capsule / recipient | 404 |
| already opened, edit after open, dup email, 21st recipient, 21st note, note after open | 409 (distinct codes) |
| iTunes search down | 502 `music_search_unavailable` |

Business rules list: min lead time (env-tunable) / 50-year max window; sealed-only editing;
no early or double opening; reflection only after opening; ≤20 recipients; ≤20 notes per
capsule; one normalized email per capsule; non-blank note fields.

**Live proof:** in Swagger, empty PATCH body → 422 with `fields`; uppercase duplicate
recipient → 409; early open → 403. Point at the envelope: *"every failure is machine-readable
and identical in shape."*

## Requirement 6 — Architecture & Testing

**Where it is:** the folder map — one sentence each, rehearse it:
- `routers/` — HTTP only: status codes, `Location` headers, calls one service function.
- `schemas/` — Pydantic contracts for input and output; routers declare `response_model`.
- `services/` — all business rules, state transitions, locks, limits.
- `models.py` — ORM mappings + DB constraints.
- `migrations/` — versioned schema. `tests/` — isolated per-test databases.

**Session usage (they explicitly grade this):** `get_session()` is a FastAPI dependency that
yields a context-managed `Session` — one session per request, rolled back/closed on the way
out even on exceptions. `expire_on_commit=False` lets objects returned after `commit()`
still serialize into the response without re-fetching (avoids DetachedInstanceError).
Unit of work ends at `db.commit()` inside the service.

**Testing:** `tests/conftest.py` gives every test a private schema `test_<uuid4>`: create →
`alembic upgrade head` through `search_path` → `TestClient` → `DROP SCHEMA CASCADE`. Parallel
-safe, dev data untouchable, and it continuously re-proves Requirement 3. Suites:
`test_api.py` (lifecycle + error codes), `test_notes.py`, `test_music.py`, `test_frontend.py`.
Then the brief's literal ask: **walk the flows in `/docs`** (the demo below).

---

## Concurrency — your "A" answer (offer it unprompted)

Every mutation calls `get_record(db, id, lock=True)` → `SELECT … FOR UPDATE` on the capsule
row (`with_for_update()` in `capsule_service.get_record`).
- Two simultaneous `POST /open` → first commits `opened_at`, second re-checks after the lock
  → 409 `already_opened`. Never two opening timestamps.
- Notes at 19/20 race: the *parent* lock serializes child counting → the 21st is refused.
  (Counting children without the parent lock is the classic race — say that.)
- Recipient cap + duplicate check: same lock, with UNIQUE as the backstop.
Isolation: default READ COMMITTED is fine *because* every write path locks-then-checks.

## Demo script (order = the grading list)

Pre-flight: `POSTGRES_PASSWORD`/`DATABASE_URL` set, `docker compose up -d --wait`,
`CAPSULE_MIN_LEAD_SECONDS=2`, start uvicorn. Keep a pre-opened capsule as fallback.
1. R1+R4 durability: create capsule (+30 s) with prediction → 201, `message: null` → add 2
   recipients, uppercase dup → 409 → **restart uvicorn** → GET: everything survived.
2. R2: early open → 403; reflection now → 403; PATCH title → 200; psql `UPDATE` violating
   `valid_seal` rejected.
3. R3 (if time): `docker compose down -v` → `up` → `alembic upgrade head` → `\dt` →
   empty but complete schema. (Or narrate the two committed revisions + per-test schemas.)
4. R4: wait → `POST /open` → letter, prediction, notes revealed → `PUT reflection` →
   GET shows both → `GET /capsules/anniversaries` → DELETE → 204 → children gone (psql).
5. R5: empty PATCH → 422 fields list. R6: point at folder structure while you do it;
   run `pytest -q` in the background if the room has time.

## Rapid-fire extras

- *Why psycopg3 and not psycopg2?* SQLAlchemy 2.0-era official psycopg (3) async-ready,
  binary COPY, maintained driver; URL rewrite in `database_url()` enforces it.
- *N+1 problem?* `selectinload(Capsule.recipients)` on list/anniversary queries — one extra
  `IN (...)` query, not one per row.
- *Why JSONB and not a columns table?* The song blob is opaque, whole-record data; JSONB
  stays structured, indexable, GIN-able later; nullable-columns design would be sparse.
- *How do anniversaries avoid timezone drift?* `func.timezone("UTC", opened_at)` converts in
  Postgres, then month/day match with `year <` requested year.
- *Scale limit of limit/offset?* Deep OFFSET scans+skips; keyset pagination on the
  `(open_at, id)` index is the upgrade path.
- *What's missing?* Auth (shared classroom collection), email delivery to stored recipients,
  encryption at rest for sealed letters. Know these before they poke — answer "scoping
  decision for this assignment; the schema is ready for it" (e.g. FK to a future users table).

## Checklist before you walk in

- [ ] Rehearse the demo end-to-end twice, including the restart and the psql cascade check.
- [ ] Saved `POSTGRES_PASSWORD` works with the existing volume; pre-opened capsule exists.
- [ ] Recitation ready: 6 requirements → one file each
      (`database.py`, `models.py`, `migrations/`, `routers/`, `schemas/+exceptions.py`, folder layout+`conftest.py`).
- [ ] `git log` on the shared repo shows the backend committed (brief: one submission per team;
      check `.gitignore` keeps `.venv`, volumes, `alembic_version`-less data files out).
- [ ] Heads-up: several docstrings/comments are in Russian (files are valid UTF-8 — the
      console just mangles them). If the jury reads English-only, offer "comments are internal
      shorthand, I'll explain any line," or translate the public docstrings in
      `schemas/base.py`, `schemas/capsule.py`, `exceptions.py` to English beforehand.
- [ ] Say the three-layer sentence and the two-one-to-many fact within the first two minutes.
