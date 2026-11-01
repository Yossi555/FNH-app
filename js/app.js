// נקודת הכניסה: בדיקת סשן, ניתוב בין המסכים לפי הכתובת (#/...), והמעטפת.
// הכתובות:
//   #/login          כניסה
//   #/dashboard      לוח בקרה
//   #/tasks          המשימות שלי
//   #/cycle/003      משימה בודדת: רשימת המחזור
//   #/post/0059      משימה בודדת: פוסט

import { loadDb, resetDb } from "./mock/store.js";
import { login, logout, getUser } from "./auth.js";
import { esc, icon, $, $$ } from "./ui.js";
import { dashboardScreen } from "./dashboard.js";
import { tasksScreen } from "./tasks.js";
import { cycleScreen } from "./posts.js";
import { postScreen } from "./texts.js";

const app = document.getElementById("app");

// ===== ניתוב =====

function parseRoute() {
  const [, name = "", param = ""] = location.hash.split("/");
  return { name, param: decodeURIComponent(param) };
}

export function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

async function route() {
  const user = getUser();
  const { name, param } = parseRoute();

  if (!user) {
    if (name !== "login") return go("#/login");
    return renderLogin();
  }
  if (name === "login" || name === "") return go("#/tasks");

  const screen = SCREENS[name];
  // כתובת לא מוכרת, מחזור שאינו בן שלוש ספרות או פוסט שאינו בן ארבע ספרות, חוזרים ל"המשימות שלי"
  if (!screen || (name === "cycle" && !/^\d{3}$/.test(param)) || (name === "post" && !/^\d{4}$/.test(param))) {
    return go("#/tasks");
  }
  renderShell(user, await screen(param, user));
}

// ===== מסך 1: כניסה =====

function renderLogin() {
  document.title = "כניסה · FNH Pipeline";
  app.innerHTML = `
    <main class="login">
      <img class="login-logo" src="assets/logo.png" alt="Fun N' Handy – Do what you love">
      <form class="login-card" id="login-form" novalidate>
        <h1 class="login-title">ברוכים הבאים</h1>
        <fieldset class="choices">
          <legend class="sr-only">מי נכנס?</legend>
          ${["yossi:יוסי", "sarit:שרית"].map((pair) => {
            const [id, name] = pair.split(":");
            return `
              <label class="choice">
                <input type="radio" name="user" value="${id}">
                <span>${name}</span>
                ${icon("user")}
              </label>`;
          }).join("")}
        </fieldset>
        <div class="field" id="pw-field" hidden>
          <label for="pw" class="sr-only">סיסמה</label>
          <div class="input-wrap">
            ${icon("lock")}
            <input class="input" id="pw" type="password" placeholder="סיסמה" autocomplete="current-password" aria-describedby="pw-err">
            <span class="err-icon" hidden>${icon("alert")}</span>
          </div>
          <p class="field-error" id="pw-err" role="alert"></p>
        </div>
        <button class="btn btn-primary btn-block" type="submit" id="login-btn" disabled>המשך</button>
      </form>
    </main>`;

  const form = $("#login-form");
  const pwField = $("#pw-field");
  const pw = $("#pw");
  const err = $("#pw-err");
  const btn = $("#login-btn");

  function showError(message) {
    pwField.classList.toggle("is-error", !!message);
    $(".err-icon", pwField).hidden = !message;
    pw.setAttribute("aria-invalid", message ? "true" : "false");
    err.textContent = message || "";
  }

  $$('input[name="user"]', form).forEach((radio) =>
    radio.addEventListener("change", () => {
      pwField.hidden = false;
      btn.disabled = false;
      showError("");
      pw.focus();
    }),
  );
  pw.addEventListener("input", () => showError(""));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = form.elements.user.value;
    if (!userId) return;
    btn.disabled = true;
    try {
      await login(userId, pw.value);
      go("#/tasks");
    } catch (error) {
      showError(error.message);
      btn.disabled = false;
      pw.focus();
    }
  });
}

// ===== המעטפת: תפריט צד, פס עליון, וכותרת בטלפון =====

function renderShell(user, { title, back, body, onMount }) {
  document.title = `${title} · FNH Pipeline`;
  const backBtn = (cls) =>
    back ? `<a class="${cls}" href="${back}" aria-label="חזרה">${icon("back")}</a>` : `<span class="${cls} is-empty"></span>`;

  app.innerHTML = `
    <a class="skip-link" href="#main">דילוג לתוכן</a>
    <div class="app">
      <aside class="sidebar" aria-label="תפריט ראשי">
        <a class="brand" href="#/tasks"><img src="assets/logo.png" alt="Fun N' Handy – המשימות שלי"></a>
        <nav class="nav">
          <a href="#/tasks" ${parseRoute().name === "tasks" ? 'aria-current="page"' : ""}>${icon("home")} המשימות שלי</a>
        </nav>
        <div class="proto-box">
          <p class="small">כלים לאב הטיפוס</p>
          <button class="link-btn small" data-action="reset">איפוס נתונים</button>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          ${backBtn("back-btn")}
          <div class="who">
            <span class="avatar" aria-hidden="true">${esc(user.name[0])}</span>
            <span class="who-name">${esc(user.name)}</span>
            <button class="link-btn small" data-action="logout">יציאה</button>
          </div>
        </header>

        <header class="mobile-head">
          ${backBtn("back-btn")}
          <span class="mobile-title" aria-hidden="true">${esc(title)}</span>
          <div class="menu-wrap">
            <button class="icon-btn menu-btn" aria-expanded="false" aria-controls="mobile-menu" aria-label="תפריט">${icon("menu")}</button>
            <div class="menu" id="mobile-menu" hidden>
              <p class="menu-user">${esc(user.name)}</p>
              <a href="#/tasks">${icon("home")} המשימות שלי</a>
              <button data-action="logout">${icon("logout")} יציאה</button>
              <hr>
              <button class="small" data-action="reset">איפוס נתונים (אב טיפוס)</button>
            </div>
          </div>
        </header>

        <main class="content" id="main" tabindex="-1">${body}</main>
      </div>
    </div>`;

  bindShell();
  onMount?.();
  // מסך חדש מתחיל מלמעלה
  window.scrollTo(0, 0);
  // המיקוד עובר לכותרת המסך, כדי שקורא מסך יודיע על המעבר
  $(".page-title")?.focus({ preventScroll: true });
}

function bindShell() {
  $$('[data-action="logout"]').forEach((b) =>
    b.addEventListener("click", async () => {
      await logout();
      go("#/login");
    }),
  );
  $$('[data-action="reset"]').forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("לאפס את כל השינויים ולחזור לנתוני הדוגמה?")) return;
      await resetDb();
      route();
    }),
  );

  const menuBtn = $(".menu-btn");
  const menu = $("#mobile-menu");
  const setMenu = (open) => {
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
  };
  menuBtn.addEventListener("click", () => {
    setMenu(menu.hidden);
    if (!menu.hidden) $("a, button", menu).focus();
  });
  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { setMenu(false); menuBtn.focus(); }
  });
}

// לחיצה מחוץ לתפריט ההמבורגר סוגרת אותו
document.addEventListener("click", (e) => {
  const menu = $("#mobile-menu");
  if (menu && !menu.hidden && !e.target.closest(".menu-wrap")) {
    menu.hidden = true;
    $(".menu-btn").setAttribute("aria-expanded", "false");
  }
});

// ===== המסכים =====
// לוח הבקרה ב-dashboard.js, "המשימות שלי" ב-tasks.js, רשימת המחזור ב-posts.js, והפוסט ב-texts.js.

const SCREENS = {
  dashboard: (param, user) => dashboardScreen(user),

  tasks: (param, user) => tasksScreen(user),

  cycle: (param, user) => cycleScreen(param, user),

  post: (param, user) => postScreen(param, user),
};

// ===== הפעלה =====

window.addEventListener("hashchange", route);

loadDb()
  .then(route)
  .catch((err) => {
    app.innerHTML = `<div class="content"><div class="banner banner-err" role="alert">${esc(err.message)}</div></div>`;
  });
