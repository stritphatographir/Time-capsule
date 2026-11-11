// Create capsule: form validation + song search through the iTunes Search API.

const form = document.getElementById("capsule-form");
const titleInput = document.getElementById("title");
const messageInput = document.getElementById("message");
const openAtInput = document.getElementById("openAt");
const charCount = document.getElementById("char-count");

const songQuery = document.getElementById("song-query");
const songSearchButton = document.getElementById("song-search-button");
const songStatus = document.getElementById("song-status");
const songResults = document.getElementById("song-results");
const selectedBox = document.getElementById("selected-song");

const resultBox = document.getElementById("result");
const submitButton = form.querySelector('button[type="submit"]');

const MAX_MESSAGE = 5000;

let selectedSong = null; // выбранная песня или null
let searchCounter = 0;   // нужен, чтобы игнорировать устаревшие ответы

// ---------- Helpers ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// datetime-local хочет формат "2026-10-30T15:42" в местном времени
function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

openAtInput.min = toLocalInputValue(new Date());

messageInput.addEventListener("input", () => {
  charCount.textContent = `${messageInput.value.length} / ${MAX_MESSAGE}`;
});

// ---------- Validation ----------

function validate() {
  const errors = {};
  const title = titleInput.value.trim();
  const message = messageInput.value.trim();

  if (title.length < 1 || title.length > 100) {
    errors.title = "Enter a title of up to 100 characters.";
  }

  if (message.length < 1) {
    errors.message = "Write a few words for your future self.";
  } else if (message.length > MAX_MESSAGE) {
    errors.message = `The letter is too long. The limit is ${MAX_MESSAGE} characters.`;
  }

  if (!openAtInput.value || !Number.isFinite(Date.parse(openAtInput.value))) {
    errors.openAt = "Choose when the capsule opens.";
  }

  return errors;
}

function showErrors(errors) {
  let firstInvalid;
  ["title", "message", "openAt"].forEach((name) => {
    const input = document.getElementById(name);
    const box = document.getElementById(`${name}-error`);

    if (errors[name]) {
      box.textContent = errors[name];
      box.hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", box.id);
      firstInvalid ??= input;
    } else {
      box.hidden = true;
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
  });
  firstInvalid?.focus();
  return Boolean(firstInvalid);
}

// ---------- Song search (fetch + async/await) ----------

function setSongStatus(text) {
  songStatus.textContent = text;
}

async function searchSongs() {
  const term = songQuery.value.trim();
  const myId = ++searchCounter;
  songResults.replaceChildren();
  if (!term) {
    setSongStatus("Type a song or an artist first.");
    return;
  }

  setSongStatus("Searching…");

  try {
    const songs = await searchSongsOnServer(term);
    if (myId !== searchCounter) return; // пришёл старый ответ, игнорируем

    if (songs.length === 0) {
      setSongStatus(`No songs found for “${term}”. Try another spelling.`);
      return;
    }

    setSongStatus("");
    songs.forEach((song) => songResults.append(buildResult(song)));
  } catch (error) {
    if (myId !== searchCounter) return;
    setSongStatus(`Couldn’t search for songs. ${error.message}`);
  }
}

function buildResult(song) {
  const item = el("li");
  const button = el("button", "song-option");
  button.type = "button";

  if (song.artwork) {
    const art = el("img");
    art.src = song.artwork;
    art.alt = "";
    art.width = 48;
    art.height = 48;
    button.append(art);
  }

  const text = el("span", "song-text");
  text.append(el("span", "song-name", song.title), el("span", "song-artist", song.artist));

  button.append(text);
  button.addEventListener("click", () => chooseSong(song));
  item.append(button);
  return item;
}

function chooseSong(song) {
  selectedSong = song;

  songResults.replaceChildren();
  setSongStatus("");
  renderSelectedSong();
}

function renderSelectedSong() {
  selectedBox.replaceChildren();
  selectedBox.hidden = selectedSong === null;
  if (!selectedSong) return;

  if (selectedSong.artwork) {
    const art = el("img");
    art.src = selectedSong.artwork;
    art.alt = "";
    art.width = 64;
    art.height = 64;
    selectedBox.append(art);
  }

  const info = el("div", "selected-info");
  info.append(el("p", "song-name", selectedSong.title), el("p", "song-artist", selectedSong.artist));

  if (selectedSong.previewUrl) {
    const audio = el("audio");
    audio.controls = true;
    audio.src = selectedSong.previewUrl;
    info.append(audio);
  } else {
    info.append(el("p", "field-hint", "This song has no audio preview."));
  }

  const remove = el("button", "button button-secondary", "Remove song");
  remove.type = "button";
  remove.addEventListener("click", () => {
    selectedSong = null;
    renderSelectedSong();
  });

  selectedBox.append(info, remove);
}

songSearchButton.addEventListener("click", searchSongs);

// Enter в поле поиска ищет песню, а не отправляет всю форму
songQuery.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchSongs();
  }
});

// ---------- Submit ----------

function showSaveError(error) {
  const errors = {};
  const otherErrors = [];
  for (const { field, message } of error.fields || []) {
    const name = field.replace(/^body\./, "");
    if (["title", "message", "openAt"].includes(name)) errors[name] = message;
    else otherErrors.push(message);
  }
  if (error.code === "invalid_open_date") errors.openAt = error.message;

  const focusedField = showErrors(errors);
  if (focusedField && otherErrors.length === 0) return;
  resultBox.textContent = otherErrors.join(" ") || error.message;
  if (error.status === 403 && error.code !== "capsule_locked") {
    resultBox.textContent = "The server refused the save request (403).";
    const localForm = new URL("create.html", LOCAL_APP_URL);
    if (window.location.origin !== localForm.origin) {
      const link = el("a", "", "Open the local create page");
      link.href = localForm.href;
      link.target = "_blank";
      link.rel = "noopener";
      resultBox.append(" ", link, ".");
    }
  }
  resultBox.hidden = false;
  if (!focusedField) resultBox.focus();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitButton.disabled) return;
  resultBox.hidden = true;
  if (showErrors(validate())) return;

  submitButton.disabled = true;
  try {
    await createCapsule({
      title: titleInput.value.trim(),
      message: messageInput.value.trim(),
      openAt: new Date(openAtInput.value).toISOString(),
      song: selectedSong,
    });
    window.location.href = "dashboard.html";
  } catch (error) {
    showSaveError(error);
    submitButton.disabled = false;
  }
});
