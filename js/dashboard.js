// Dashboard: loads capsules and shows them as cards with a live countdown.

const grid = document.getElementById("grid");
const statusBox = document.getElementById("status");
const summary = document.getElementById("summary");
const tabs = document.querySelectorAll(".tab");

let capsules = [];
let currentFilter = "all"; // "all" | "sealed" | "opened"
let timerId = null;

// Капсула открыта, если дата открытия уже прошла
const isOpen = (capsule) => new Date(capsule.openAt).getTime() <= Date.now();

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
    statusBox.append(el("p", "status-text", "Nothing here yet. Write a letter to your future self."));
    const link = el("a", "button", "Create a capsule");
    link.href = "create.html";
    statusBox.append(link);
  }
}

// ---------- Countdown ----------

function buildCountdown(openAt) {
  const wrap = el("div", "countdown");
  wrap.dataset.openAt = openAt;
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
  let someCapsuleOpened = false;

  document.querySelectorAll(".countdown").forEach((wrap) => {
    if (updateCountdown(wrap) <= 0) someCapsuleOpened = true;
  });

  // Когда время вышло, просим данные заново (позже это сделает сервер)
  if (someCapsuleOpened) loadCapsules(true);
}

// ---------- Cards ----------

function recipientsText(count) {
  if (count === 0) return "Only for you";
  return count === 1 ? "Shared with 1 person" : `Shared with ${count} people`;
}

function buildCard(capsule) {
  const open = isOpen(capsule);
  const card = el("article", open ? "card card-open" : "card card-sealed");

  const head = el("div", "card-head");
  head.append(
    el("h2", "card-title", capsule.title),
    el("span", "badge", open ? "Opened" : "Sealed")
  );
  card.append(head);

  card.append(
    el("p", "card-meta", `${recipientsText(capsule.recipientCount)}. Created ${formatDate(capsule.createdAt)}.`)
  );

  if (open) {
    // Если сервер прислал письмо, показываем начало. Иначе просто отмечаем, что капсула открыта.
    card.append(el("p", "letter", capsule.message || "This capsule is open."));
    const link = el("a", "card-link", "Read the letter");
    link.href = `capsule.html?id=${encodeURIComponent(capsule.id)}`;
    card.append(link);
  } else {
    // Закрытая капсула: только таймер и дата, содержимого нет
    card.append(buildCountdown(capsule.openAt));
    card.append(el("p", "opens-on", `Opens on ${formatDate(capsule.openAt)}`));
    const link = el("a", "card-link", "View capsule");
    link.href = `capsule.html?id=${encodeURIComponent(capsule.id)}`;
    card.append(link);
  }

  return card;
}

// ---------- Render ----------

function render() {
  const sealed = capsules.filter((c) => !isOpen(c));
  const opened = capsules.filter(isOpen);

  summary.textContent = `${sealed.length} sealed, ${opened.length} opened`;

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

  if (document.querySelector(".countdown")) {
    timerId = setInterval(tick, 1000);
  }
}

// ---------- Loading data ----------
// ---------- Loading data ----------

async function loadCapsules(silent = false) {
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
