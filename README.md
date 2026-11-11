# Time-capsule

Write a letter to yourself or someone you love, choose when it opens, and break the seal when the countdown ends. Add an optional prediction so you can see what you thought would happen when you read the letter again.

## Run locally on Windows

From the project folder, install the backend dependencies and start the API:

```powershell
py -3 -m venv venv
.\venv\Scripts\python.exe -m pip install -r 'Time-capsule backend/requirements.txt'
.\venv\Scripts\python.exe -m uvicorn app.main:app --app-dir 'Time-capsule backend' --host 127.0.0.1 --port 8000
```

In a second terminal, serve the website:

```powershell
.\venv\Scripts\python.exe -m http.server 5500 --bind 127.0.0.1
```

Open [the website](http://127.0.0.1:5500) or [the API docs](http://127.0.0.1:8000/docs). The homepage has a 10-second example that uses a sample letter in the browser. Capsules created through the form use the API and are cleared when the API restarts. The prototype runs locally with a shared capsule list.

## Defense demo

Run the 10-second example to show the countdown, the seal, and the prediction reveal. Then show the three API workflows in Swagger:

1. **Write and seal.** Create a capsule with a future opening time. You can edit it while it is sealed. The API keeps the letter and prediction out of its responses.
2. **Manage recipients.** Add, list, or remove recipients on a sealed capsule. Adding the same email twice returns a conflict.
3. **Open and read.** An early opening returns `403`. Once the capsule is ready, breaking the seal reveals the letter and prediction.
