const grid = document.getElementById("grid");
const cardTemplate = document.getElementById("capsule-card");
const statusBox = document.getElementById("status");
const statusText = document.getElementById("status-text");
const retryButton = document.getElementById("retry");
const createLink = document.getElementById("create-link");

const openingDateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

const capsuleStates = {
  sealed: { badge: "Sealed", action: "View countdown" },
  ready: { badge: "Ready", action: "Open capsule" },
  opened: { badge: "Opened", action: "Read the letter" },
};

function makeCard(capsule) {
  const state = capsuleStates[capsule.status];
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  card.classList.add(capsule.status === "sealed" ? "card-sealed" : "card-open");
  card.querySelector("h2").textContent = capsule.title;
  card.querySelector(".badge").textContent = state.badge;

  const openingDate = card.querySelector("time");
  openingDate.dateTime = capsule.openAt;
  openingDate.textContent = openingDateFormat.format(new Date(capsule.openAt));

  const link = card.querySelector("a");
  link.href = capsule.href;
  link.textContent = state.action;
  link.setAttribute("aria-label", `${state.action} for ${capsule.title}`);
  return card;
}

async function loadCapsules() {
  statusBox.hidden = false;
  statusText.textContent = "Loading your capsules…";
  retryButton.hidden = true;
  createLink.hidden = true;

  try {
    const capsules = await getCapsules();
    grid.replaceChildren(...capsules.map(makeCard));

    if (capsules.length === 0) {
      statusText.textContent = "No capsules yet. Write your first letter to the future.";
      createLink.hidden = false;
    } else {
      statusBox.hidden = true;
    }
  } catch (error) {
    statusText.textContent = `Couldn’t load your capsules. ${error.message}`;
    retryButton.hidden = false;
  }
}

retryButton.addEventListener("click", loadCapsules);
loadCapsules();
