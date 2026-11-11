// Dashboard: loads capsules and shows them as cards with a live countdown.

const grid = document.getElementById("grid");
const statusBox = document.getElementById("status");
const summary = document.getElementById("summary");
const tabs = document.querySelectorAll(".tab");

let capsules = [];
let currentFilter = "all"; // "all" | "sealed" | "opened"
let timerId = null;
let loading = false;
let nextRefreshAt = 0;

function capsuleState(capsule) {
  return capsule.status ?? (Date.parse(capsule.openAt) <= Date.now() ? "opened" : "sealed");
}

// Создаёт элемент. Текст ставим через textContent, а не innerHTML (безопасно).
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

// ---------- Loading, error and empty states ----------

function showStatus(kind, message) {
  statusBox.replaceChildren();
  statusBox.hidden = kind === "none";

  if (kind === "loading") {
    statusBox.append(el("p", "status-text", "Loading your capsules…"));
  }

  if (kind === "error") {
    statusBox.append(el("p", "status-text", `Couldn’t load your capsules. ${message}`));
    const retry = el("button", "button", "Try again");
    retry.addEventListener("click", () => loadCapsules());
    statusBox.append(retry);
  }

  if (kind === "empty") {
    if (capsules.length > 0) {
      statusBox.append(el("p", "status-text", `No ${currentFilter} capsules.`));
      return;
    }
    statusBox.append(el("p", "status-text", "Nothing here yet. Write a letter to your future self."));
    const link = el("a", "button", "Create a capsule");
    link.href = "create.html";
    statusBox.append(link);
  }
}

// ---------- Countdown ----------

function buildCountdown(capsule) {
  const wrap = el("div", "countdown");
  wrap.dataset.openAt = capsule.openAt;
  wrap.setAttribute("role", "timer");

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

// Обновляет цифры и возвращает, сколько миллисекунд осталось
function updateCountdown(wrap) {
  const left = new Date(wrap.dataset.openAt).getTime() - Date.now();
  const time = splitTime(left);

  wrap.querySelectorAll(".countdown-value").forEach((node) => {
    const n = time[node.dataset.unit];
    node.textContent = node.dataset.unit === "days" ? String(n) : String(n).padStart(2, "0");
  });

  return left;
}

function tick() {
  if (loading) return;
  let shouldRefresh = false;

  grid.querySelectorAll(".countdown").forEach((wrap) => {
    if (updateCountdown(wrap) <= 0) shouldRefresh = true;
  });

  // The browser clock can reach zero before the server considers a capsule ready.
  const now = performance.now();
  if (shouldRefresh && now >= nextRefreshAt) {
    nextRefreshAt = now + 5000;
    loadCapsules(true);
  }
}

// ---------- Cards ----------

function recipientsText(capsule) {
  const count = capsule.recipientCount;
  if (isApiCapsuleId(capsule.id)) {
    if (count === 0) return "No recipients added";
    return count === 1 ? "1 recipient" : `${count} recipients`;
  }
  if (count === 0) return "Only for you";
  return count === 1 ? "Shared with 1 person" : `Shared with ${count} people`;
}

function buildCard(capsule) {
  const state = capsuleState(capsule);
  const card = el("article", state === "sealed" ? "card card-sealed" : "card card-open");
  const labels = { sealed: "Sealed", ready: "Ready", opened: "Opened" };

  const head = el("div", "card-head");
  head.append(
    el("h2", "card-title", capsule.title),
    el("span", "badge", labels[state])
  );
  card.append(head);

  card.append(
    el("p", "card-meta", `${recipientsText(capsule)}. Created ${formatDate(capsule.createdAt)}.`)
  );

  let linkText;
  if (state === "opened") {
    card.append(el("p", "letter", capsule.message || "This capsule is open."));
    linkText = "Read the letter";
  } else if (state === "ready") {
    linkText = "Break the seal";
  } else {
    card.append(buildCountdown(capsule));
    card.append(el("p", "opens-on", `Opens on ${formatDate(capsule.openAt)}`));
    linkText = "View capsule";
  }

  const link = el("a", "card-link", linkText);
  link.href = `capsule.html?id=${encodeURIComponent(capsule.id)}`;
  card.append(link);
  return card;
}

// ---------- Render ----------

function render() {
  const sealed = capsules.filter((capsule) => capsuleState(capsule) === "sealed");
  const ready = capsules.filter((capsule) => capsuleState(capsule) === "ready");
  const opened = capsules.filter((capsule) => capsuleState(capsule) === "opened");

  const readySummary = ready.length ? `${ready.length} ready, ` : "";
  summary.textContent = `${sealed.length} sealed, ${readySummary}${opened.length} opened`;

  const visible =
    currentFilter === "sealed" ? sealed : currentFilter === "opened" ? opened : capsules;

  grid.replaceChildren();
  clearInterval(timerId);

  if (visible.length === 0) {
    showStatus("empty");
    return;
  }

  showStatus("none");
  visible.forEach((capsule) => grid.append(buildCard(capsule)));

  if (grid.querySelector(".countdown")) {
    timerId = setInterval(tick, 1000);
  }
}

// ---------- Loading data ----------

async function loadCapsules(silent = false) {
  if (loading) return;
  loading = true;
  clearInterval(timerId);
  if (!silent) {
    grid.replaceChildren();
    showStatus("loading");
  }

  try {
    capsules = await getCapsules();
    render();
  } catch (error) {
    clearInterval(timerId);
    showStatus("error", error.message);
  } finally {
    loading = false;
  }
}

// ---------- Filter tabs ----------

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    currentFilter = tab.dataset.filter;
    tabs.forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
    render();
  });
});

loadCapsules();
