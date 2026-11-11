const API_URL = "http://127.0.0.1:8000";
const BROWSER_CAPSULES_KEY = "capsules";

async function requestCapsules(path = "", options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}/capsules${path}`, { cache: "no-store", ...options });
  } catch {
    throw new Error("Couldn’t reach the Time Capsule API. Check that it’s running on port 8000.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error?.message || `The API returned status ${response.status}.`);
  }
  return response.json();
}

function browserCapsules() {
  try {
    const saved = JSON.parse(localStorage.getItem(BROWSER_CAPSULES_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function legacyStatus(capsule) {
  if (new Date(capsule.openAt).getTime() > Date.now()) return "sealed";
  try {
    if (localStorage.getItem(`capsule-broken:${capsule.id}`) === "1") return "opened";
  } catch {
    // The letter can still be opened when browser storage is unavailable.
  }
  return "ready";
}

async function getCapsules() {
  const capsules = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const page = await requestCapsules(`?limit=${pageSize}&offset=${offset}`);
    for (const { id, title, openAt, status } of page) {
      capsules.push({ title, openAt, status, href: `capsule.html?api=${id}` });
    }
    if (page.length < pageSize) break;
  }

  for (const capsule of browserCapsules()) {
    capsules.push({
      title: capsule.title,
      openAt: capsule.openAt,
      status: legacyStatus(capsule),
      href: `capsule.html?id=${encodeURIComponent(capsule.id)}`,
    });
  }
  return capsules;
}

function createCapsule(payload) {
  return requestCapsules("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function getCapsule(id) {
  return requestCapsules(`/${encodeURIComponent(id)}`);
}

function openCapsule(id) {
  return requestCapsules(`/${encodeURIComponent(id)}/open`, { method: "POST" });
}

async function getLegacyCapsule(id) {
  const saved = browserCapsules().find((item) => String(item.id) === id);
  if (saved) return saved;

  // Keep links to the original bundled examples working.
  const response = await fetch("capsules.json");
  if (!response.ok) throw new Error("Couldn’t load the sample capsules.");
  const examples = await response.json();
  return examples.find((item) => String(item.id) === id) || null;
}
