// "המשימות שלי": חישוב המשימות, תאריכי היעד וההתראות, והמסך עצמו.
// משימה היא מחזור (ARCHITECTURE סעיף 5, "התראות ומשימות").

import { DUE_DAYS } from "./config.js";
import { listPosts, postStatus, suggestCycle } from "./posts.js";
import { esc, icon, badge, shortDate, openModal, rerender, STATUS_LABELS, $, $$ } from "./ui.js";

const TASK_LABELS = { edit: "עריכה והזנה", text: "כתיבת מלל", complete: "השלמת גרסאות", wait: "ממתין לשרית" };
const STATUS_ORDER = ["empty", "draft", "approved", "finished"];

// ===== חישוב =====

function groupByCycle(posts) {
  const map = new Map();
  for (const p of posts) {
    if (!map.has(p.cycle)) map.set(p.cycle, []);
    map.get(p.cycle).push(p);
  }
  return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
}

function countStatuses(posts) {
  const counts = {};
  for (const p of posts) {
    const s = postStatus(p);
    counts[s] = (counts[s] || 0) + 1;
  }
  return counts;
}

// role: "owner" (יוסי) או "user" (שרית)
export function computeTasks(posts, role) {
  const tasks = [];
  for (const [cycle, cyclePosts] of groupByCycle(posts)) {
    const base = { cycle, counts: countStatuses(cyclePosts) };

    if (role === "owner") {
      const before = tasks.length;
      if (cyclePosts.some((p) => !p.editing_done)) tasks.push({ ...base, type: "edit", due: null });
      if (cyclePosts.every((p) => p.text_done) && cyclePosts.some((p) => !p.finished)) {
        tasks.push({ ...base, type: "complete", due: null });
      }
      // החלטה של יוסי (31.10), תוספת לטבלה ב-ARCHITECTURE סעיף 5: מחזור ששרית כותבת בו
      // מופיע ליוסי כשורה אפורה "ממתין לשרית", בלי התראה ובלי תאריך יעד, כדי שיוכל להגיע אליו
      if (tasks.length === before && cyclePosts.some((p) => p.editing_done && !p.text_done)) {
        tasks.push({ ...base, type: "wait", due: null });
      }
    } else {
      const waiting = cyclePosts.filter((p) => p.editing_done && !p.text_done);
      if (waiting.length) {
        // תאריך יעד: הלחיצה הראשונה של יוסי על "סיימתי", ועוד 3 ימים
        const start = Math.min(...waiting.map((p) => new Date(p.editing_done_at).getTime()));
        tasks.push({ ...base, type: "text", due: new Date(start + DUE_DAYS * 86400000) });
      }
    }
  }
  return tasks;
}

// ===== התראות =====
// התראה = משימה שהגיעה מהמשתמש השני ועוד לא נראתה.
// הנחה: במקום זמן הביקור הקודם, נשמרת ב-localStorage רשימת המשימות שכבר הוצגו.
// הסיבה: ל"סיימתי" של שרית אין שדה זמן בטבלה, ולכן אי אפשר לדעת מתי "השלמת גרסאות" הופיעה.

const NOTIFY_TYPES = { text: "מחזור {c} מוכן לכתיבת מלל", complete: "שרית סיימה את המלל במחזור {c}" };

function seenKey(userId) {
  return `fnh-seen-tasks-${userId}`;
}

function readSeen(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(seenKey(userId)) || "[]")); } catch { return new Set(); }
}

function writeSeen(userId, keys) {
  try { localStorage.setItem(seenKey(userId), JSON.stringify([...keys])); } catch { /* העדפת תצוגה בלבד */ }
}

function takeNotifications(userId, tasks) {
  const seen = readSeen(userId);
  const fresh = tasks.filter((t) => NOTIFY_TYPES[t.type] && !seen.has(`${t.cycle}:${t.type}`));
  fresh.forEach((t) => seen.add(`${t.cycle}:${t.type}`));
  writeSeen(userId, seen);
  return fresh.map((t) => NOTIFY_TYPES[t.type].replace("{c}", t.cycle));
}

// ===== המסך =====

let activeFilter = "all";

function statusBadges(counts) {
  const parts = STATUS_ORDER.filter((s) => counts[s]).map((s) => badge(s, counts[s]));
  return `<span class="badges">${parts.join("")}</span>`;
}

function dueText(task) {
  return task.due ? shortDate(task.due) : "—";
}

function renderList(tasks) {
  const shown = activeFilter === "all" ? tasks : tasks.filter((t) => t.counts[activeFilter]);

  if (!tasks.length) return `<p class="empty-state">אין משימות כרגע. כשיגיע תורך, המשימה תופיע כאן.</p>`;
  if (!shown.length) return `<p class="empty-state">אין משימות עם פוסטים בסטטוס ${STATUS_LABELS[activeFilter]}.</p>`;

  const rows = shown.map((t) => `
    <tr data-href="#/cycle/${t.cycle}" ${t.type === "wait" ? 'class="is-waiting"' : ""}>
      <td class="num" dir="ltr">${t.cycle}</td>
      <td>${TASK_LABELS[t.type]}</td>
      <td>${statusBadges(t.counts)}</td>
      <td>${dueText(t)}</td>
      <td class="chev-cell">
        <a class="back-btn" href="#/cycle/${t.cycle}" aria-label="פתיחת מחזור ${t.cycle}, ${TASK_LABELS[t.type]}">${icon("forward")}</a>
      </td>
    </tr>`).join("");

  const cards = shown.map((t) => `
    <li>
      <a class="card task-card ${t.type === "wait" ? "is-waiting" : ""}" href="#/cycle/${t.cycle}">
        <span class="task-card-body">
          <b>מחזור <span dir="ltr">${t.cycle}</span> · ${TASK_LABELS[t.type]}</b>
          ${t.due ? `<span class="small muted-text">תאריך יעד: ${dueText(t)}</span>` : ""}
          ${statusBadges(t.counts)}
        </span>
        ${icon("forward")}
      </a>
    </li>`).join("");

  return `
    <div class="tbl-wrap task-table">
    <table class="tbl">
      <caption class="sr-only">המשימות שלי</caption>
      <thead><tr>
        <th scope="col">מחזור</th><th scope="col">משימה</th><th scope="col">פוסטים</th>
        <th scope="col">תאריך יעד</th><th scope="col"><span class="sr-only">פתיחה</span></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>
    <ul class="plain-list task-cards">${cards}</ul>`;
}

export async function tasksScreen(user) {
  const posts = await listPosts();
  const tasks = computeTasks(posts, user.role);
  const notes = takeNotifications(user.id, tasks);
  const isOwner = user.role === "owner";

  const filters = [["all", "הכל"], ["draft", "טיוטה"], ["approved", "מאושר"], ["finished", "גמור"]];

  const body = `
    <div class="titlebar">
      <h1 class="page-title" tabindex="-1">המשימות שלי</h1>
      ${isOwner ? `<button class="btn btn-primary" id="new-cycle">+ מחזור חדש</button>` : ""}
    </div>

    ${notes.length ? `
      <div class="banner banner-ai notify" role="status">
        ${icon("bell")}
        <ul class="notify-list">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
      </div>` : ""}

    <div class="list-tools">
      <div class="pills" role="group" aria-label="סינון לפי סטטוס">
        ${filters.map(([id, label]) => `
          <button class="pill" data-filter="${id}" aria-pressed="${activeFilter === id}">${label}</button>`).join("")}
      </div>
      <button class="link-btn small" id="refresh">רענון</button>
    </div>

    <div id="task-list">${renderList(tasks)}</div>`;

  function onMount() {
    const list = $("#task-list");

    $$(".pill").forEach((btn) =>
      btn.addEventListener("click", () => {
        activeFilter = btn.dataset.filter;
        $$(".pill").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        list.innerHTML = renderList(tasks);
      }),
    );

    // לחיצה בכל מקום בשורה פותחת את המחזור. במקלדת משתמשים בקישור החץ
    list.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-href]");
      if (row && !e.target.closest("a")) location.hash = row.dataset.href;
    });

    $("#refresh").addEventListener("click", rerender);

    $("#new-cycle")?.addEventListener("click", () => openNewCycle(posts));
  }

  return { title: "המשימות שלי", back: null, body, onMount };
}

// ===== חלון: מחזור חדש =====

export function openNewCycle(posts) {
  const suggested = suggestCycle(posts);
  openModal({
    title: "מחזור חדש",
    primary: "יצירה",
    body: `
      <div class="field" id="cycle-field">
        <label for="cycle-num">מספר מחזור</label>
        <input class="input ltr" id="cycle-num" name="cycle" dir="ltr" inputmode="numeric"
               maxlength="3" value="${suggested}" aria-describedby="cycle-err">
        <p class="field-error" id="cycle-err" role="alert"></p>
      </div>`,
    onSubmit(form) {
      const value = form.elements.cycle.value.trim();
      if (!/^\d{3}$/.test(value)) {
        $("#cycle-field", form).classList.add("is-error");
        $("#cycle-err", form).textContent = "מספר המחזור צריך להיות בן שלוש ספרות.";
        form.elements.cycle.focus();
        return false;
      }
      // המחזור הוא שדה בפוסט, ולכן הוא נשמר רק כשמוסיפים לו את הפוסט הראשון
      location.hash = `#/cycle/${value}`;
    },
  });
}
