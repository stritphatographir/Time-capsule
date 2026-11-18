# Time Capsule

Send a letter, a song, and a prediction to your future self. FastAPI holds the contents back until the opening date arrives and someone breaks the seal. After opening, you can write a reflection and revisit the letter on its anniversary.

## Run locally on Windows

You need Python 3.13 or later and PostgreSQL. The included Docker Compose service starts a local PostgreSQL instance with a named volume. From the repository root, run these commands in the same PowerShell window:

```powershell
$env:POSTGRES_PASSWORD = [guid]::NewGuid().ToString('N')
# Save this value privately for future runs with the same volume.
$env:DATABASE_URL = "postgresql+psycopg://capsule:$($env:POSTGRES_PASSWORD)@127.0.0.1:5432/capsules"
docker compose up -d --wait
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r 'Time-capsule backend/requirements-dev.txt'
.\.venv\Scripts\python.exe -m alembic -c 'Time-capsule backend/alembic.ini' upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir 'Time-capsule backend' --host 127.0.0.1 --port 8000
```

For later runs, reuse the same password and URL. With an existing PostgreSQL server, set `DATABASE_URL` to a database your role owns and skip the Docker commands. URL-encode special characters in credentials. Apply Alembic migrations before starting the API. Tables and data survive process restarts and `docker compose down`.

Open [the website](http://127.0.0.1:8000/app/) to create letters, attach songs, and break seals. Use [Swagger UI](http://127.0.0.1:8000/docs) for the full API, including predictions, reflections, anniversaries, and recipients. Original browser saves and bundled examples are separate from database records. This classroom app shares one collection and has no user authentication.

## Try a group capsule

On the website, **New capsule** lets you seal an optional prediction with your letter. After you break the seal, **Looking back** shows your prediction and lets you write or edit what actually happened. Your saved reflection is included in the keepsake download. In **Your capsules**, search by title or choose **Ready** to find a letter you can open. A filtered archive can be bookmarked.

Create a capsule on the website and share its detail-page link with someone who can reach the same server. While the countdown runs, choose **Tuck in a note**, sign it and submit. Each capsule holds up to 20 notes. A signature is a display name. The count is visible while the capsule is sealed. Breaking the seal reveals every note in the order it was added.

On an opened capsule, **Download keepsake (.txt)** saves the original letter, dates, signed notes and any attached song title, prediction or reflection. The file can be read offline.

In Swagger, use **POST /capsules/{capsule_id}/notes** with `{"signature":"Ana","text":"Remember the lake?"}`. Retrieve the capsule before and after opening to see the response change. Adding a note after the deadline or to a full capsule returns 409. Deleting a capsule also deletes its notes.

## Demonstrate the assignment in Swagger

1. Expand **POST /capsules**, select **Try it out**, enter a title, message, future `openAt` in ISO 8601, and optional `prediction`, then **Execute**. Copy the returned ID. Expect 201 with the letter and prediction hidden. A past opening date gives 400.
2. Use **POST /capsules/{capsule_id}/recipients** to add two people. Try adding the first email again in uppercase. The duplicate gives 409. Listing the capsule shows the recipient count.
3. Before the opening date, try editing the title (200), opening the seal (403), and writing a reflection (403). Restart the API with the same URL and retrieve the capsule and its recipients.
4. For a short demo, set `$env:CAPSULE_MIN_LEAD_SECONDS = '2'` before starting the API and create a letter due about 30 seconds from now. When ready, **POST /capsules/{capsule_id}/open** reveals its prediction and song. **PUT /capsules/{capsule_id}/reflection** accepts `{"text":"Here is what actually happened."}`. Retrieve the letter to see the original prediction and your later reflection together.
5. In **GET /capsules/anniversaries**, enter the UTC date one year after you opened that letter. The archive returns previously opened letters whose opening anniversary falls on that day. Without a date it uses today in UTC.
6. Delete the capsule (204). Getting it again gives 404 and PostgreSQL removes its recipients.

## Data model and tests

A capsule has many recipients. PostgreSQL enforces the foreign key, cascading deletion, unique normalized email per capsule, and constraints on seal dates and reflections. The services lock the parent row when changing a capsule or its recipients so concurrent requests respect the seal and the 20-recipient limit.

Tests require a PostgreSQL database where the test role can create schemas. Each test migrates a uniquely named schema and removes it afterward. In a terminal with the environment above:

```powershell
$env:TEST_DATABASE_URL = $env:DATABASE_URL
cd 'Time-capsule backend'
..\.venv\Scripts\python.exe -m pytest -q
```
