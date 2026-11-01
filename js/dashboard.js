// לוח הבקרה: חישוב השלב של כל מחזור, והכרטיסים הצפים (ARCHITECTURE סעיף 5, "לוח בקרה"; DESIGN מסך 1א).
// מחושב בדפדפן מתוך posts, בכל טעינה. זהה ליוסי ולשרית, ולצפייה בלבד.

import { DUE_DAYS } from "./config.js";
import { listPosts, LENGTHS } from "./posts.js";
import { openNewCycle } from "./tasks.js";
import { avatar, shortDate, PEOPLE, $$ } from "./ui.js";

const STAGE_LABELS = { edit: "עריכה והזנה", text: "כתיבת מלל", complete: "השלמת גרסאות", done: "הושלם" };

// ===== חישוב =====

// פוסט שסומן בו לפחות אורך אחד או "תמונות מוכנות"
function isMarked(post) {
  return LENGTHS.some((len) => post[`has_${len}`]) || post.yt_long_seconds > 0 || post.images_ready;
}

// השלב של מחזור אחד. בודקים לפי הסדר, והתנאי הראשון שמתקיים קובע.
// מחזור מעורב, למשל פוסט שנוסף אחרי "סיימתי", חוזר לכן ל"עריכה והזנה" (הנחה ב-ARCHITECTURE).
export function cycleStage(posts) {
  const total = posts.length;
  const count = (fn) => posts.filter(fn).length;
  const postsText = total === 1 ? "פוסט אחד" : `${total} פוסטים`;

  if (posts.some((p) => !p.editing_done)) {
    return { stage: "edit", who: "owner", line: postsText, done: count(isMarked), total };
  }
  if (posts.some((p) => !p.text_done)) {
    const start = Math.min(...posts.map((p) => new Date(p.editing_done_at).getTime()));
    const done = count((p) => p.status === "approved");
    return { stage: "text", who: "user", line: `${done} מתוך ${total} אושרו`, done, total, due: new Date(start + DUE_DAYS * 86400000) };
  }
  if (posts.some((p) => !p.finished)) {
    const done = count((p) => p.finished);
    return { stage: "complete", who: "owner", line: `${done} מתוך ${total} גמורים`, done, total };
  }
  return { stage: "done", who: null, line: total === 1 ? "פוסט אחד גמור" : `${total} פוסטים גמורים`, done: total, total };
}

// כרטיס לכל מחזור. פעילים קודם, מהמספר הגבוה לנמוך, ואחריהם המחזורים שהושלמו
export function computeCycles(posts) {
  const byCycle = new Map();
  for (const p of posts) {
    if (!byCycle.has(p.cycle)) byCycle.set(p.cycle, []);
    byCycle.get(p.cycle).push(p);
  }
  return [...byCycle.entries()]
    .map(([cycle, list]) => ({ cycle, ...cycleStage(list) }))
    .sort((a, b) => (a.stage === "done") - (b.stage === "done") || b.cycle.localeCompare(a.cycle));
}

// ===== המסך =====

function stageText(c) {
  return c.who ? `${PEOPLE[c.who]} – ${STAGE_LABELS[c.stage]}` : STAGE_LABELS[c.stage];
}

function cardHtml(c) {
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  // הנחה: במחזור שהושלם אין אצל מי, ולכן במקום האווטאר מוצג סימן ✓
  const who = c.who ? avatar(c.who, 40) : `<span class="fc-done" aria-hidden="true">✓</span>`;
  return `
    <li>
      <a class="float-card stage-${c.stage}" href="#/cycle/${c.cycle}">
        <span class="fc-head">
          <span class="fc-num"><span class="sr-only">מחזור </span><span dir="ltr">${c.cycle}</span></span>
          ${who}
        </span>
        <span class="fc-stage">${stageText(c)}</span>
        <span class="fc-line">${c.line}</span>
        ${c.stage === "done" ? "" : `<span class="fc-bar" aria-hidden="true"><span style="inline-size: ${pct}%"></span></span>`}
        ${c.due ? `<span class="fc-due">יעד ${shortDate(c.due)}</span>` : ""}
      </a>
    </li>`;
}

// הטיה לכיוון העכבר: עד 11 מעלות בכל ציר. רק בעכבר, ולא כשהמשתמש ביקש "הפחתת תנועה"
const MAX_TILT = 11;

function bindTilt() {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  $$(".float-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--ry", `${(x * 2 * MAX_TILT).toFixed(1)}deg`);
      card.style.setProperty("--rx", `${(-y * 2 * MAX_TILT).toFixed(1)}deg`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.removeProperty("--rx");
      card.style.removeProperty("--ry");
    });
  });
}

export async function dashboardScreen(user) {
  const posts = await listPosts();
  const cycles = computeCycles(posts);
  const isOwner = user.role === "owner";

  const body = `
    <div class="titlebar">
      <h1 class="page-title" tabindex="-1">לוח בקרה</h1>
      <div class="title-actions">
        ${isOwner ? `<button class="btn btn-secondary" id="new-cycle">+ מחזור חדש</button>` : ""}
        <a class="btn btn-primary" href="#/tasks">המשימות שלי</a>
      </div>
    </div>

    ${cycles.length
      ? `<ul class="plain-list float-grid" aria-label="מחזורים">${cycles.map(cardHtml).join("")}</ul>`
      : `<p class="empty-state">עוד אין מחזורים. כשיוסי יפתח מחזור, הוא יופיע כאן.</p>`}`;

  function onMount() {
    bindTilt();
    $$("#new-cycle").forEach((b) => b.addEventListener("click", () => openNewCycle(posts)));
  }

  return { title: "לוח בקרה", back: null, body, onMount };
}
