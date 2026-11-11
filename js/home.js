// Home page: a short summary of your capsules and a random letter from the past.

const statsBox = document.getElementById("stats");
const letterSection = document.getElementById("letter-section");
const letterBox = document.getElementById("letter");

let capsules = [];
let lastLetterId = null; // чтобы «Another letter» не показывало то же письмо

// ---------- Helpers ----------

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

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// «58 days», «5 hours», «12 minutes»
function timeUntil(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return plural(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return plural(hours, "hour");
  return plural(Math.floor(hours / 24), "day");
}

function excerpt(text, max = 240) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const end = cut.lastIndexOf(" ");
  return (end > 0 ? cut.slice(0, end) : cut) + "…";
}

const capsuleLink = (id) => `capsule.html?id=${encodeURIComponent(id)}`;

// ---------- Summary ----------

function renderStats() {
  statsBox.replaceChildren();

  if (capsules.length === 0) {
    statsBox.append("You have no capsules yet. The first one takes about two minutes to write.");
    return;
  }

  const sealed = capsules
    .filter((c) => !isOpen(c))
    .sort((a, b) => new Date(a.openAt) - new Date(b.openAt));
  const opened = capsules.filter(isOpen);

  statsBox.append(`You have ${plural(sealed.length, "sealed capsule")} and ${opened.length} opened. `);

  if (sealed.length === 0) {
    statsBox.append("Everything is open. Time to write a new one.");
    return;
  }

  const next = sealed[0];
  const link = el("a", "", `“${next.title}”`);
  link.href = capsuleLink(next.id);
  statsBox.append("The next one, ", link, ` opens in ${timeUntil(new Date(next.openAt).getTime() - Date.now())}.`);
}

// ---------- Letter from the past ----------

function pickLetter() {
  const pool = capsules.filter((c) => isOpen(c) && c.message);
  const choices = pool.length > 1 ? pool.filter((c) => c.id !== lastLetterId) : pool;
  const letter = choices[Math.floor(Math.random() * choices.length)];
  return { letter, count: pool.length };
}

function renderLetter(focusButton = false) {
  letterSection.hidden = false;
  letterBox.replaceChildren();

  const { letter, count } = pickLetter();

  if (!letter) {
    const next = capsules
      .filter((c) => !isOpen(c))
      .sort((a, b) => new Date(a.openAt) - new Date(b.openAt))[0];

    letterBox.append(
      el(
        "p",
        "letter-quote",
        next
          ? `No letters have arrived yet. The first one opens on ${formatDate(next.openAt)}.`
          : "No letters have arrived yet. Write a capsule and it will appear here when it opens."
      )
    );
    return;
  }

  lastLetterId = letter.id;

  letterBox.append(el("p", "letter-quote", excerpt(letter.message)));
  letterBox.append(el("p", "card-meta", `${letter.title}. Written on ${formatDate(letter.createdAt)}.`));

  const actions = el("div", "letter-actions");
  const read = el("a", "button", "Read the whole letter");
  read.href = capsuleLink(letter.id);
  actions.append(read);

  if (count > 1) {
    const another = el("button", "button button-secondary", "Another letter");
    another.type = "button";
    another.addEventListener("click", () => renderLetter(true));
    actions.append(another);
  }

  letterBox.append(actions);

  if (focusButton) {
    const again = actions.querySelector("button");
    if (again) again.focus();
  }
}

// ---------- Loading ----------

async function load() {
  statsBox.textContent = "Loading your capsules…";

  try {
    capsules = await getCapsules();
    renderStats();
    renderLetter();
  } catch (error) {
    letterSection.hidden = true;
    statsBox.replaceChildren(`Couldn’t load your capsules. ${error.message} `);
    const retry = el("button", "button button-secondary", "Try again");
    retry.type = "button";
    retry.addEventListener("click", load);
    statsBox.append(retry);
  }
}

load();
