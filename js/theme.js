// Тема оформления: сохранённый выбор или системная настройка.
// Скрипт подключается в <head>, чтобы страница не мигала светлым перед тёмной темой.

(function () {
  const KEY = "theme";

  function storedTheme() {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  const saved = storedTheme();
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved === "dark" || saved === "light" ? saved : systemDark ? "dark" : "light");

  // Кнопка есть в шапке каждой страницы, но появляется в DOM позже, чем этот скрипт
  document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("theme-toggle");
    if (!button) return;

    const sync = () => {
      button.setAttribute("aria-pressed", String(document.documentElement.dataset.theme === "dark"));
    };
    sync();

    button.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // хранилище недоступно: тема просто не запомнится
      }
      sync();
    });
  });
})();
