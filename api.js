async function fetchAllCapsules() {
  const response = await fetch("capsules.json");
  if (!response.ok) {
    throw new Error(`The server answered with status ${response.status}.`);
  }
  const fromFile = await response.json();

  // капсулы, созданные на create.html
  let fromStorage = [];
  try {
    fromStorage = JSON.parse(localStorage.getItem("capsules") || "[]");
  } catch (error) {
    console.error("Could not read saved capsules:", error);
  }

  return [...fromFile, ...fromStorage];
}

// Правило замка
function applyLock(capsule) {
  const copy = { ...capsule };
  if (new Date(copy.openAt).getTime() > Date.now()) {
    delete copy.message;
    delete copy.song;
  }
  return copy;
}

// Все капсулы (у закрытых нет письма)
async function getCapsules() {
  const all = await fetchAllCapsules();
  return all.map(applyLock);
}

// Одна капсула по id или null, если такой нет
async function getCapsule(id, openAtOverride = null) {
  const all = await fetchAllCapsules();
  const found = all.find((capsule) => String(capsule.id) === String(id));
  if (!found) return null;

  const capsule = { ...found };

  // Только для демонстрации: ?demo=20 сдвигает дату открытия на 20 секунд вперёд
  if (openAtOverride) capsule.openAt = openAtOverride;

  return applyLock(capsule);
}