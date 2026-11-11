# Time-capsule

Write a letter to your future self or someone you love, optionally add a song, and choose when to break the seal.

## Run locally

From the repository root on Windows:

```powershell
py -3.13 -m venv venv
.\venv\Scripts\python.exe -m pip install -r 'Time-capsule backend/requirements.txt'
.\venv\Scripts\python.exe -m uvicorn app.main:app --app-dir 'Time-capsule backend' --host 127.0.0.1 --port 8000
```

Open [Time Capsule](http://127.0.0.1:8000/app/) or [Swagger](http://127.0.0.1:8000/docs). The same FastAPI process serves both. [The health check](http://127.0.0.1:8000/healthz) reports whether the API is running.

For Live Server development, the frontend still works at [127.0.0.1:5500](http://127.0.0.1:5500/) with the API running on port 8000. Older browser saves remain visible at the address where they were created. Bundled examples are available at either address.

## Capsule flow

New capsules are saved through FastAPI. The server marks a capsule **sealed**, **ready**, or **opened** and returns the letter and song only after a successful opening. Swagger also exposes editing, deletion, and recipient management.

The local prototype uses a shared list and in-memory storage. API records reset when the process restarts.
