// Capsule page. Three states:
//   sealed  - the date has not come yet: countdown, no content
//   ready   - the date has come: the person breaks the seal
//   opened  - the letter and the song are shown
// Plus a block "On this day in history" from the Wikipedia API.

const stage = document.getElementById("stage");
const historyBox = document.getElementById("history");

const params = new URLSearchParams(window.location.search);
const capsuleId = params.get("id");

// The demo parameter adjusts a bundled example only. The API controls saved capsules.
const demoSeconds = Number(params.get("demo")) || 0;
const demoOpenAt = demoSeconds > 0 && demoSeconds <= 3600
  ? new Date(Date.now() + demoSeconds * 1000).toISOString()
  : null;

let capsule = null;
let timerId = null;
let historyLoadedFor = null;

// ---------- Helpers (похожие функции есть в dashboard.js) ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const isOpen = (c) => new Date(c.openAt).getTime() <= Date.now();

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateTime(iso) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${formatDate(iso)}, ${time}`;
}

function splitTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function recipientsText(count) {
  if (count === 0) return "Only for you";
  return count === 1 ? "Shared with 1 person" : `Shared with ${count} people`;
}

// Only older browser saves and examples need a browser-side seal marker.
const brokenKey = () => `capsule-broken:${capsuleId}`;

function wasBroken() {
  if (capsule.demo) return false;
  try {
    return localStorage.getItem(brokenKey()) === "1";
  } catch {
    return false;
  }
}

function markBroken() {
  try {
    localStorage.setItem(brokenKey(), "1");
  } catch {
    // хранилище недоступно, это не страшно
  }
}

// ---------- Messages: loading, error, not found ----------

function showMessage(kind, details) {
  clearInterval(timerId);
  stage.replaceChildren();
  historyBox.hidden = true;

  const box = el("div", "status");

  if (kind === "loading") {
    box.append(el("p", "status-text", "Loading the capsule…"));
  }

  if (kind === "not-found") {
    box.append(el("p", "status-text", "We couldn’t find this capsule. Check the link or pick one from your list."));
    const link = el("a", "button", "Go to your capsules");
    link.href = "dashboard.html";
    box.append(link);
  }

  if (kind === "error") {
    box.append(el("p", "status-text", `Couldn’t load the capsule. ${details}`));
    const retry = el("button", "button", "Try again");
    retry.addEventListener("click", () => loadCapsule());
    box.append(retry);
  }

  stage.append(box);
}

// ---------- Seal and countdown ----------

function buildSeal() {
  const seal = el("div", "seal");
  seal.setAttribute("aria-hidden", "true");
  seal.append(el("span", "seal-half seal-left"), el("span", "seal-half seal-right"));
  return seal;
}

function buildCountdown(openAt) {
  const wrap = el("div", "countdown");
  wrap.dataset.openAt = openAt;
  wrap.setAttribute("role", "timer");
  wrap.setAttribute("aria-label", "Time until the capsule opens");
  wrap.setAttribute("aria-live", "off");

  ["days", "hours", "minutes", "seconds"].forEach((unit) => {
    const part = el("div", "countdown-part");
    const value = el("span", "countdown-value", "0");
    value.dataset.unit = unit;
    part.append(value, el("span", "countdown-unit", unit));
    wrap.append(part);
  });

  updateCountdown(wrap);
  return wrap;
}

function updateCountdown(wrap) {
  const left = new Date(wrap.dataset.openAt).getTime() - Date.now();
  const time = splitTime(left);

  wrap.querySelectorAll(".countdown-value").forEach((node) => {
    const n = time[node.dataset.unit];
    const value = node.dataset.unit === "days" ? String(n) : String(n).padStart(2, "0");
    if (node.textContent !== value) node.textContent = value;
  });
  wrap.classList.toggle("has-long-days", String(time.days).length > 3);

  return left;
}

async function tick() {
  const wrap = document.querySelector(".countdown");
  if (!wrap) return;

  if (updateCountdown(wrap) <= 0) {
    clearInterval(timerId);
    await loadCapsule(true);
  }
}

// ---------- The three states ----------

function buildTitle() {
  const title = el("h1", "capsule-title", capsule.title);
  title.tabIndex = -1; // чтобы можно было перевести фокус программно
  return title;
}

function metaText() {
  const count = capsule.recipientCount;
  let recipients = recipientsText(count);
  if (isApiCapsuleId(capsuleId)) {
    recipients = count === 0 ? "No recipients added" : `${count} recipient${count === 1 ? "" : "s"}`;
  }
  return `${recipients}. Written on ${formatDate(capsule.createdAt)}.`;
}

function renderSealed() {
  const card = el("article", "capsule-card is-centered");
  card.append(buildSeal(), buildTitle(), el("p", "card-meta", metaText()));
  card.append(buildCountdown(capsule.openAt));
  card.append(el("p", "opens-on", `Opens on ${formatDateTime(capsule.openAt)}`));

  if (capsule.demo) {
    card.append(el("p", "demo-note", `Demo mode: the opening date was moved to ${demoSeconds} seconds from page load.`));
  }

  stage.append(card);
  // The server may still report sealed if the browser clock is ahead.
  const pastLocalDeadline = Date.parse(capsule.openAt) <= Date.now();
  timerId = setInterval(tick, pastLocalDeadline ? 5000 : 1000);
}

function renderReady() {
  const card = el("article", "capsule-card is-centered");
  card.append(buildSeal(), buildTitle(), el("p", "card-meta", metaText()));
  card.append(el("p", "ready-text", "The day has come. This capsule is ready to open."));

  const button = el("button", "button capsule-open-button", "Break the seal");
  button.type = "button";
  const error = el("p", "field-error");
  error.setAttribute("role", "alert");
  error.hidden = true;
  button.addEventListener("click", () => breakSeal(card, button, error));
  card.append(button, error);

  stage.append(card);
}

async function breakSeal(card, button, errorBox) {
  button.disabled = true;
  errorBox.hidden = true;

  if (isApiCapsuleId(capsuleId)) {
    try {
      capsule = await openCapsule(capsuleId);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      button.disabled = false;
      return;
    }
  } else if (!capsule.demo) {
    markBroken();
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    renderOpened(true);
    return;
  }

  card.querySelector(".seal").classList.add("breaking");
  setTimeout(() => renderOpened(true), 1000);
}

function buildSong(song) {
  const box = el("div", "song-card");

  if (song.artwork) {
    const art = el("img");
    art.src = song.artwork;
    art.alt = "";
    art.width = 64;
    art.height = 64;
    box.append(art);
  }

  const info = el("div", "selected-info");
  info.append(el("p", "song-name", song.title), el("p", "song-artist", song.artist));

  let audio = null;
  if (song.previewUrl) {
    audio = el("audio");
    audio.controls = true;
    audio.src = song.previewUrl;
    info.append(audio);
  }

  box.append(info);
  return { box, audio };
}

function renderOpened(justOpened) {
  clearInterval(timerId);
  stage.replaceChildren();

  const card = el("article", justOpened ? "capsule-card reveal" : "capsule-card");
  const title = buildTitle();
  card.append(title, el("p", "card-meta", metaText()));

  const letter = el("div", "letter-body");
  (capsule.message || "").split(/\n+/).forEach((line) => letter.append(el("p", "", line)));
  card.append(letter);

  let audio = null;
  if (capsule.song) {
    const song = buildSong(capsule.song);
    audio = song.audio;
    card.append(song.box);
  }

  stage.append(card);
  title.focus({ preventScroll: true });

  // Музыка включается только сразу после клика пользователя (так разрешают браузеры)
  if (justOpened && audio) {
    audio.play().catch(() => {});
  }
}

function render() {
  clearInterval(timerId);
  stage.replaceChildren();

  const status = capsule.status || (!isOpen(capsule) ? "sealed" : wasBroken() ? "opened" : "ready");
  if (status === "sealed") {
    renderSealed();
  } else if (status === "ready") {
    renderReady();
  } else {
    renderOpened(false);
  }

  loadHistory();
}

// ---------- On this day (Wikipedia API) ----------

function formatYear(year) {
  return year < 0 ? `${Math.abs(year)} BC` : String(year);
}

// Берём 4 события из разных эпох
function pickEvents(events) {
  const sorted = [...events].sort((a, b) => a.year - b.year);
  if (sorted.length <= 4) return sorted;
  return [0, 1, 2, 3].map((i) => sorted[Math.floor((i * (sorted.length - 1)) / 3)]);
}

function buildEvent(event) {
  const item = el("li", "history-item");
  item.append(el("span", "history-year", formatYear(event.year)));

  const text = el("div");
  text.append(el("p", "history-text", event.text));

  const page = event.pages && event.pages[0];
  const url = page && page.content_urls && page.content_urls.desktop && page.content_urls.desktop.page;
  if (url && url.startsWith("https://en.wikipedia.org/")) {
    const link = el("a", "card-link", "Read on Wikipedia");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    text.append(link);
  }

  item.append(text);
  return item;
}

async function loadHistory() {
  const date = new Date(capsule.openAt);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const key = `${month}-${day}`;

  if (historyLoadedFor === key) {
    historyBox.hidden = false;
    return;
  }
  historyLoadedFor = key;

  const dayLabel = date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  historyBox.hidden = false;
  historyBox.replaceChildren(el("h2", "history-title", `On ${dayLabel} in history`));

  const body = el("div", "history-body");
  body.append(el("p", "status-text", "Looking through the archives…"));
  historyBox.append(body);

  try {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`);
    if (!response.ok) {
      throw new Error(`Wikipedia answered with status ${response.status}.`);
    }

    const data = await response.json();
    const events = pickEvents(data.events || []);
    body.replaceChildren();

    if (events.length === 0) {
      body.append(el("p", "status-text", "No events found for this day."));
      return;
    }

    const list = el("ul", "history-list");
    events.forEach((event) => list.append(buildEvent(event)));
    body.append(list, el("p", "history-source", "Source: Wikipedia"));
  } catch (error) {
    historyLoadedFor = null; // чтобы можно было повторить
    body.replaceChildren(el("p", "status-text", `Couldn’t load events for this day. ${error.message}`));
    const retry = el("button", "button button-secondary", "Try again");
    retry.addEventListener("click", () => loadHistory());
    body.append(retry);
  }
}

// ---------- Loading the capsule ----------

async function loadCapsule(silent = false) {
  if (!capsuleId) {
    showMessage("not-found");
    return;
  }

  if (!silent) showMessage("loading");

  try {
    const result = await getCapsule(capsuleId, demoOpenAt);
    if (!result) {
      showMessage("not-found");
      return;
    }
    capsule = result;
    render();
  } catch (error) {
    showMessage("error", error.message);
  }
}

loadCapsule();
