const LOCAL_APP_URL = "http://127.0.0.1:8000/app/";
const liveServerHost = window.location.hostname === "localhost" ? "localhost" : "127.0.0.1";
const API_ORIGIN = window.location.pathname.startsWith("/app/")
  ? ""
  : `http://${liveServerHost}:8000`;

class ApiError extends Error {
  constructor(response, error) {
    super(error?.message || `The API returned status ${response.status}.`);
    this.status = response.status;
    this.code = error?.code;
    this.fields = error?.fields || [];
  }
}

async function requestApi(path, options = {}) {
  let response;
  try {
    response = await fetch(API_ORIGIN + path, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      ...options,
    });
  } catch (error) {
    if (error.name === "TimeoutError") throw new Error("The Time Capsule API took too long to respond.");
    throw new Error("Can’t reach the Time Capsule API. Check that the server is running.");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response, data?.error);
  }
  return response.json();
}

function requestCapsules(path = "", options = {}) {
  return requestApi("/capsules" + path, options);
}

function searchSongsOnServer(query) {
  return requestApi(`/songs/search?${new URLSearchParams({ q: query })}`);
}

function isApiCapsuleId(id) {
  return /^api:[1-9]\d*$/.test(id);
}

function apiCapsule(record) {
  // The API and bundled examples both start numbering capsules at 1.
  return { ...record, id: `api:${record.id}` };
}

async function getServerCapsules() {
  const pageSize = 100;
  const all = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await requestCapsules(`?limit=${pageSize}&offset=${offset}`);
    all.push(...page.map(apiCapsule));
    if (page.length < pageSize) return all;
  }
}

async function getExamples() {
  const response = await fetch("capsules.json");
  if (!response.ok) throw new Error(`Couldn’t load the example capsules (${response.status}).`);
  return response.json();
}

function getBrowserCapsules() {
  try {
    const saved = JSON.parse(localStorage.getItem("capsules") || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function applyLock(capsule) {
  if (Date.parse(capsule.openAt) <= Date.now()) return capsule;
  const { message, song, ...metadata } = capsule;
  return metadata;
}

async function getCapsules() {
  const [examples, server] = await Promise.all([getExamples(), getServerCapsules()]);
  return [...examples, ...getBrowserCapsules()].map(applyLock).concat(server);
}

async function getCapsule(id, demoOpenAt = null) {
  if (isApiCapsuleId(id)) {
    try {
      return apiCapsule(await requestCapsules(`/${id.slice(4)}`));
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  const examples = await getExamples();
  const example = examples.find((item) => String(item.id) === id);
  if (example) {
    return applyLock(demoOpenAt ? { ...example, openAt: demoOpenAt, demo: true } : example);
  }
  const saved = getBrowserCapsules().find((item) => String(item.id) === id);
  return saved ? applyLock(saved) : null;
}

async function createCapsule(payload) {
  const record = await requestCapsules("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return apiCapsule(record);
}

async function openCapsule(id) {
  try {
    return apiCapsule(await requestCapsules(`/${id.slice(4)}/open`, { method: "POST" }));
  } catch (error) {
    // Another tab may have opened this capsule while the current page was still ready.
    if (error.code !== "already_opened") throw error;
    const capsule = await getCapsule(id);
    if (capsule?.status === "opened") return capsule;
    throw error;
  }
}
