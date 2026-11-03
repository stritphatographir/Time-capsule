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

const MAX_MESSAGE = 5000;
const ONE_MINUTE = 60 * 1000;
const FIFTY_YEARS = 50 * 365 * 24 * 60 * 60 * 1000;

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

openAtInput.min = toLocalInputValue(new Date(Date.now() + ONE_MINUTE));

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

  if (!openAtInput.value) {
    errors.openAt = "Choose when the capsule opens.";
  } else {
    const openTime = new Date(openAtInput.value).getTime();
    if (openTime < Date.now() + ONE_MINUTE) {
      errors.openAt = "The opening date must be at least one minute from now.";
    } else if (openTime > Date.now() + FIFTY_YEARS) {
      errors.openAt = "Choose a date within the next 50 years.";
    }
  }

  return errors;
}

function showErrors(errors) {
  ["title", "message", "openAt"].forEach((name) => {
    const input = document.getElementById(name);
    const box = document.getElementById(`${name}-error`);

    if (errors[name]) {
      box.textContent = errors[name];
      box.hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", box.id);
    } else {
      box.hidden = true;
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
  });
}

// ---------- Song search (fetch + async/await) ----------

function setSongStatus(text) {
  songStatus.textContent = text;
}

async function searchSongs() {
  const term = songQuery.value.trim();
  if (!term) {
    setSongStatus("Type a song or an artist first.");
    return;
  }

  const myId = ++searchCounter;
  songResults.replaceChildren();
  setSongStatus("Searching…");

  try {
    const params = new URLSearchParams({ term, media: "music", entity: "song", limit: "8" });
    const response = await fetch(`https://itunes.apple.com/search?${params}`);

    if (!response.ok) {
      throw new Error(`iTunes answered with status ${response.status}.`);
    }

    const data = await response.json();
    if (myId !== searchCounter) return; // пришёл старый ответ, игнорируем

    if (data.results.length === 0) {
      setSongStatus(`No songs found for “${term}”. Try another spelling.`);
      return;
    }

    setSongStatus("");
    data.results.forEach((song) => songResults.append(buildResult(song)));
  } catch (error) {
    if (myId !== searchCounter) return;
    setSongStatus(`Couldn’t search iTunes. ${error.message} Check your connection and try again.`);
  }
}

function buildResult(song) {
  const item = el("li");
  const button = el("button", "song-option");
  button.type = "button";

  const art = el("img");
  art.src = song.artworkUrl60;
  art.alt = "";
  art.width = 48;
  art.height = 48;

  const text = el("span", "song-text");
  text.append(el("span", "song-name", song.trackName), el("span", "song-artist", song.artistName));

  button.append(art, text);
  button.addEventListener("click", () => chooseSong(song));
  item.append(button);
  return item;
}

function chooseSong(song) {
  selectedSong = {
    title: song.trackName,
    artist: song.artistName,
    previewUrl: song.previewUrl,
    artwork: song.artworkUrl100,
  };

  songResults.replaceChildren();
  setSongStatus("");
  renderSelectedSong();
}

function renderSelectedSong() {
  selectedBox.replaceChildren();
  selectedBox.hidden = selectedSong === null;
  if (!selectedSong) return;

  const art = el("img");
  art.src = selectedSong.artwork;
  art.alt = "";
  art.width = 64;
  art.height = 64;

  const info = el("div", "selected-info");
  info.append(el("p", "song-name", selectedSong.title), el("p", "song-artist", selectedSong.artist));

  const audio = el("audio");
  audio.controls = true;
  audio.src = selectedSong.previewUrl;
  info.append(audio);

  const remove = el("button", "button button-secondary", "Remove song");
  remove.type = "button";
  remove.addEventListener("click", () => {
    selectedSong = null;
    renderSelectedSong();
  });

  selectedBox.append(art, info, remove);
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

function showResult(capsule) {
  resultBox.replaceChildren();

  const heading = el("h2", "", "Capsule ready");
  const note = el(
    "p",
    "",
    "There is no server yet, so nothing is saved. Later this data will be sent to the API. For now, here it is as JSON."
  );
  const json = el("pre", "result-json", JSON.stringify(capsule, null, 2));

  resultBox.append(heading, note, json);
  resultBox.hidden = false;
  resultBox.focus();
  resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const errors = validate();
  showErrors(errors);

  const firstInvalid = ["title", "message", "openAt"].find((name) => errors[name]);
  if (firstInvalid) {
    document.getElementById(firstInvalid).focus();
    resultBox.hidden = true;
    return;
  }

  const capsule = {
  id: Date.now(),
  title: titleInput.value.trim(),
  message: messageInput.value.trim(),
  createdAt: new Date().toISOString(),
  openAt: new Date(openAtInput.value).toISOString(),
  recipientCount: 0,
  song: selectedSong,
};

try {
  const saved = JSON.parse(localStorage.getItem("capsules") || "[]");
  saved.push(capsule);
  localStorage.setItem("capsules", JSON.stringify(saved));
} catch (error) {
  console.error("Could not save capsule:", error);
  return;
}

window.location.href = "dashboard.html";
});
