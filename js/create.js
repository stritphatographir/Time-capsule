const form = document.getElementById("capsule-form");
const titleInput = document.getElementById("title");
const messageInput = document.getElementById("message");
const openAtInput = document.getElementById("openAt");
const predictionInput = document.getElementById("prediction");
const submitButton = form.querySelector("button[type=submit]");
const formError = document.getElementById("form-error");

function localInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
openAtInput.value = localInputValue(tomorrow);

for (const input of [titleInput, messageInput]) {
  input.addEventListener("input", () => input.setCustomValidity(""));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.hidden = true;

  const title = titleInput.value.trim();
  const message = messageInput.value.trim();
  titleInput.setCustomValidity(title ? "" : "Enter a title.");
  messageInput.setCustomValidity(message ? "" : "Write a few words in your letter.");
  if (!form.reportValidity()) return;

  submitButton.disabled = true;
  try {
    const capsule = await createCapsule({
      title,
      message,
      openAt: new Date(openAtInput.value).toISOString(),
      prediction: predictionInput.value.trim() || null,
    });
    window.location.href = `capsule.html?api=${capsule.id}`;
  } catch (error) {
    formError.textContent = error.message;
    formError.hidden = false;
  } finally {
    submitButton.disabled = false;
  }
});
