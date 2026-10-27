// theme.js
// Dark mode (night mode) shared by both pages.
// - Loaded in the <head>, so the saved theme is applied BEFORE the page appears (no flash).
// - The choice is remembered with localStorage, so the second page uses the same theme.
// - The button needs the id "themeBtn" in the HTML.

const THEME_KEY = "sketchly-theme";

function getSavedTheme() {
  try { return localStorage.getItem(THEME_KEY); }
  catch (error) { return null; }                  // storage can be blocked: ignore
}

function saveTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); }
  catch (error) { /* ignore */ }
}

// Put the theme on the <html> element: the CSS reads [data-theme="dark"]
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const button = document.getElementById("themeBtn");
  if (button) {
    button.textContent = theme === "dark" ? "☀️" : "🌙";
    button.title = theme === "dark" ? "Switch to day mode" : "Switch to night mode";
  }
}

// 1) Choose the starting theme: saved choice, otherwise the device setting
const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
applyTheme(getSavedTheme() || (prefersDark ? "dark" : "light"));

// 2) When the page is ready, connect the button
document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("themeBtn");
  if (!button) {
    console.warn('theme.js: no element with id="themeBtn" in this page.');
    return;
  }
  applyTheme(document.documentElement.getAttribute("data-theme"));   // update the icon
  button.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    saveTheme(next);
  });
});