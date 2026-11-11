const LOCAL_APP_URL = "http://127.0.0.1:8000/app/";
const DEMO_CAPSULE_ID = "demo";
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

function songStoreUrl(song) {
  try {
    const url = new URL(song.storeUrl);
    if (url.protocol === "https:" && ["music.apple.com", "itunes.apple.com"].includes(url.hostname)) {
      return url.href;
    }
  } catch {
    // Older saves may have no store URL.
  }
  return null;
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

// Keep the seal markers written by earlier versions of the capsule page.
const brokenKey = (id) => `capsule-broken:${id}`;

function wasBroken(capsule) {
  if (capsule.demo) return false;
  try {
    return localStorage.getItem(brokenKey(capsule.id)) === "1";
  } catch {
    return false;
  }
}

function browserCapsuleStatus(capsule) {
  if (Date.parse(capsule.openAt) <= Date.now()) {
    return wasBroken(capsule) ? "opened" : "ready";
  }
  return "sealed";
}

function applyLock(capsule) {
  const status = browserCapsuleStatus(capsule);
  if (status === "opened") return { ...capsule, status };
  const { message, song, ...metadata } = capsule;
  return { ...metadata, status };
}

async function getCapsules() {
  const [examples, server] = await Promise.all([getExamples(), getServerCapsules()]);
  const listedExamples = examples.filter((capsule) => capsule.id !== DEMO_CAPSULE_ID);
  return [...listedExamples, ...getBrowserCapsules()].map(applyLock).concat(server);
}

async function findBrowserCapsule(id, demoOpenAt) {
  const examples = await getExamples();
  const example = examples.find((item) => String(item.id) === id);
  if (example && demoOpenAt) {
    return { ...example, openAt: demoOpenAt, demo: true };
  }
  if (example?.id === DEMO_CAPSULE_ID) return null;
  return example ?? getBrowserCapsules().find((item) => String(item.id) === id);
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

  const capsule = await findBrowserCapsule(id, demoOpenAt);
  return capsule ? applyLock(capsule) : null;
}

async function createCapsule(payload) {
  const record = await requestCapsules("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return apiCapsule(record);
}

async function openBrowserCapsule(id, demoOpenAt) {
  const capsule = await findBrowserCapsule(id, demoOpenAt);
  if (!capsule) throw new Error("We couldn’t find this capsule.");
  if (browserCapsuleStatus(capsule) === "sealed") {
    throw new Error("The opening date hasn’t arrived yet.");
  }

  if (!capsule.demo) {
    try {
      localStorage.setItem(brokenKey(capsule.id), "1");
    } catch {
      // The capsule can still be opened for this visit.
    }
  }
  return { ...capsule, status: "opened" };
}

async function openCapsule(id, demoOpenAt = null) {
  if (!isApiCapsuleId(id)) return openBrowserCapsule(id, demoOpenAt);

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
