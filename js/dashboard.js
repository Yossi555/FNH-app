// לוח הבקרה: חישוב השלב של כל מחזור, והכרטיסים הצפים (ARCHITECTURE סעיף 5, "לוח בקרה"; DESIGN מסך 1א).
// מחושב בדפדפן מתוך posts, בכל טעינה. זהה ליוסי ולשרית, ולצפייה בלבד.
// חישוב השלב והפס משותפים גם ל"המשימות שלי" ולרשימת המחזור (ARCHITECTURE סעיף 5, "אותו חישוב במסכים נוספים").

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

// ===== השלב בטקסט ובפס, לכל המסכים =====

export function stageText(c) {
  return c.who ? `${PEOPLE[c.who]} - ${STAGE_LABELS[c.stage]}` : STAGE_LABELS[c.stage];
}

// פס בשלושה מקטעים, מקטע לכל שלב (ARCHITECTURE סעיף 5): שלב שעבר מלא, השלב הנוכחי לפי ההתקדמות,
// ושלב עתידי ריק. במחזור שהושלם שלושתם מלאים
const BAR_STAGES = ["edit", "text", "complete"];

// cls: מחלקה נוספת לגודל, למשל לפס הקטן ברשימת המחזור
export function stageBar(c, cls = "") {
  const current = c.stage === "done" ? BAR_STAGES.length : BAR_STAGES.indexOf(c.stage);
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  const segs = BAR_STAGES.map((stage, i) => {
    const fill = i < current ? 100 : i === current ? pct : 0;
    return `<span class="fc-seg seg-${stage}"><span style="inline-size: ${fill}%"></span></span>`;
  });
  return `<span class="fc-bar${cls ? ` ${cls}` : ""}" aria-hidden="true">${segs.join("")}</span>`;
}

// נקודה בצבע השלב, לעמודת המשימה ב"המשימות שלי"
export function stageDot(stage) {
  return `<span class="stage-dot dot-${stage}" aria-hidden="true"></span>`;
}

// ===== המסך =====

function cardHtml(c) {
  // הנחה: במחזור שהושלם אין אצל מי, ולכן במקום האווטאר מוצג סימן ✓
  const who = c.who ? avatar(c.who, 80) : `<span class="fc-done" aria-hidden="true">✓</span>`;
  return `
    <li>
      <a class="float-card stage-${c.stage}" href="#/cycle/${c.cycle}">
        <span class="fc-head">
          <span class="fc-num"><span class="sr-only">מחזור </span><span dir="ltr">${c.cycle}</span></span>
          ${who}
        </span>
        <span class="fc-stage">${stageText(c)}</span>
        <span class="fc-line">${c.line}</span>
        ${stageBar(c)}
        ${c.due ? `<span class="fc-due">יעד ${shortDate(c.due)}</span>` : ""}
      </a>
    </li>`;
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
    $$("#new-cycle").forEach((b) => b.addEventListener("click", () => openNewCycle(posts)));
  }

  return { title: "לוח בקרה", back: null, body, onMount };
}
