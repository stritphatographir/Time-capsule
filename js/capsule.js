const stage = document.getElementById("stage");
const params = new URLSearchParams(window.location.search);
const apiId = params.get("api");
const legacyId = params.get("id");
const demo = !apiId && !legacyId && params.get("demo") === "1";
const sample = {
  title: "A note to my future self",
  openAt: new Date(Date.now() + 10000).toISOString(),
  message: "Dear future me, today I finally got my bike out of the garage. I hope getting back on it felt as good as I imagined.",
  prediction: "By the time I open this, I’ll have ridden to the lake.",
};

let timer;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showMessage(text, retry) {
  const box = el("div", "status");
  box.append(el("p", "status-text", text));
  if (retry) {
    const button = el("button", "button", "Try again");
    button.addEventListener("click", loadCapsule);
    box.append(button);
  }
  stage.replaceChildren(box);
}

function buildSeal() {
  const seal = el("div", "seal");
  seal.setAttribute("aria-hidden", "true");
  seal.append(el("span", "seal-half seal-left"), el("span", "seal-half seal-right"));
  return seal;
}

function startCountdown(card, openAt) {
  const countdown = el("div", "countdown");
  countdown.setAttribute("role", "timer");
  const units = [["days", 86400], ["hours", 3600], ["minutes", 60], ["seconds", 1]];
  const values = units.map(([unit]) => {
    const part = el("div", "countdown-part");
    const value = el("span", "countdown-value");
    part.append(value, el("span", "countdown-unit", unit));
    countdown.append(part);
    return value;
  });
  card.append(countdown);
  if (!demo) {
    const date = new Date(openAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    card.append(el("p", "opens-on", `Opens ${date}`));
  }

  function tick() {
    const left = Date.parse(openAt) - Date.now();
    let seconds = Math.max(0, Math.ceil(left / 1000));
    units.forEach(([, size], index) => {
      const value = Math.floor(seconds / size);
      values[index].textContent = String(value).padStart(2, "0");
      seconds %= size;
    });
    if (left <= 0) {
      clearInterval(timer);
      loadCapsule();
    }
  }

  timer = setInterval(tick, 250);
  // Let the server confirm the state after the local clock reaches zero.
  if (Date.parse(openAt) > Date.now()) tick();
}

function showLetter(card, capsule) {
  card.append(el("p", "letter-body", capsule.message));
  if (capsule.prediction) {
    const prediction = el("section", "prediction");
    prediction.append(el("h2", "", "Your prediction"), el("p", "", capsule.prediction));
    card.append(prediction);
  }
  // Songs from older capsules are still available after opening.
  if (capsule.song) {
    const song = el("div", "song-card");
    song.append(el("p", "", `${capsule.song.title} · ${capsule.song.artist}`));
    if (capsule.song.previewUrl) {
      const audio = el("audio");
      audio.controls = true;
      audio.src = capsule.song.previewUrl;
      song.append(audio);
    }
    card.append(song);
  }
}

async function breakSeal(capsule, card, button, errorBox) {
  button.disabled = true;
  errorBox.hidden = true;

  let opened;
  try {
    opened = apiId ? await openCapsule(apiId) : { ...capsule, status: "opened" };
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
    button.disabled = false;
    return;
  }

  if (legacyId && !apiId) {
    try {
      localStorage.setItem(`capsule-broken:${legacyId}`, "1");
    } catch {
      // The letter can still be read during this visit.
    }
  }

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    card.querySelector(".seal").classList.add("breaking");
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  render(opened, true);
}

function render(capsule, focusTitle = false) {
  clearInterval(timer);
  const opened = capsule.status === "opened";
  const card = el("article", opened ? "capsule-card" : "capsule-card is-centered");
  const title = el("h1", "capsule-title", capsule.title);
  if (!opened) card.append(buildSeal());
  card.append(title);

  if (capsule.status === "sealed") {
    startCountdown(card, capsule.openAt);
  } else if (capsule.status === "ready") {
    card.append(el("p", "ready-text", "Your capsule is ready to open."));
    const button = el("button", "button", "Break the seal");
    const errorBox = el("p", "field-error");
    errorBox.hidden = true;
    errorBox.setAttribute("role", "alert");
    button.addEventListener("click", () => breakSeal(capsule, card, button, errorBox));
    card.append(button, errorBox);
  } else {
    showLetter(card, capsule);
  }

  if (demo) card.append(el("p", "demo-note", "10-second demo · sample letter"));
  stage.replaceChildren(card);
  if (focusTitle) {
    title.tabIndex = -1;
    title.focus();
  }
}

async function loadCapsule() {
  clearInterval(timer);
  if (!stage.hasChildNodes()) showMessage("Loading the capsule…");

  try {
    if (demo) {
      const status = Date.parse(sample.openAt) <= Date.now() ? "ready" : "sealed";
      render({ ...sample, status });
    } else if (apiId) {
      render(await getCapsule(apiId));
    } else if (legacyId) {
      const saved = await getLegacyCapsule(legacyId);
      if (saved) render({ ...saved, status: legacyStatus(saved) });
      else showMessage("This capsule couldn’t be found.");
    } else {
      showMessage("Choose a capsule from your list.");
    }
  } catch (error) {
    showMessage(error.message, true);
  }
}

loadCapsule();
