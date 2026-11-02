// יוסי: מחזורים ופוסטים, והמסך "משימה בודדת: רשימת המחזור".
// כל הפונקציות כאן אסינכרוניות, כמו קריאות ל-Supabase. באב הטיפוס הן עובדות מול js/mock/store.js.

import { getDb, saveDb } from "./mock/store.js";
import { START_POST_NUMBER } from "./config.js";
import { createRows, renameRows } from "./rows.js";
import { esc, icon, badge, openModal, rerender, listOrigin, setFlash, renderFlash, $, $$ } from "./ui.js";
import { cycleStage, stageText, stageBar } from "./dashboard.js";

export async function listPosts() {
  return getDb().posts.map((p) => ({ ...p }));
}

// הסטטוס שמוצג לפוסט: "גמור" גובר על הסטטוס של שרית
export function postStatus(post) {
  if (post.finished) return "finished";
  return post.status || "empty";
}

// מספר המחזור המוצע (ARCHITECTURE סעיף 5, "מספור"):
// המחזור הגבוה ביותר, אם יש בו פוסטים שעוד לא נערכו. אחרת הגבוה ועוד 1. אם אין מחזורים, 001.
export function suggestCycle(posts) {
  if (!posts.length) return "001";
  const top = posts.map((p) => p.cycle).sort().at(-1);
  const stillOpen = posts.some((p) => p.cycle === top && !p.editing_done);
  return stillOpen ? top : String(Number(top) + 1).padStart(3, "0");
}

// מספר הפוסט הבא: הגבוה ביותר ועוד 1, בארבע ספרות. אם אין פוסטים, START_POST_NUMBER
export function nextPostNumber(posts) {
  if (!posts.length) return START_POST_NUMBER;
  const top = Math.max(...posts.map((p) => Number(p.post_number)));
  return String(top + 1).padStart(4, "0");
}

export async function listCycle(cycle) {
  return (await listPosts())
    .filter((p) => p.cycle === cycle)
    .sort((a, b) => a.post_number.localeCompare(b.post_number));
}

export async function getPost(number) {
  const post = getDb().posts.find((p) => p.post_number === number);
  return post ? { ...post } : null;
}

// fields: video_name, has_10..has_60, yt_long_seconds, images_ready
export async function addPost(cycle, fields) {
  const db = getDb();
  const post = {
    has_10: false, has_15: false, has_30: false, has_60: false,
    yt_long_seconds: null, images_ready: false,
    editing_done: false, editing_done_at: null,
    prompt: "", landing_page: null,
    status: null, approved_at: null,
    text_done: false, finished: false,
    ...fields,
    post_number: nextPostNumber(db.posts),
    cycle,
    created_at: new Date().toISOString(),
  };
  db.posts.push(post);
  saveDb();
  return { ...post };
}

// עדכון השדות של יוסי בפוסט אחד
const OWNER_FIELDS = ["video_name", "has_10", "has_15", "has_30", "has_60", "yt_long_seconds", "images_ready"];

export async function updatePost(number, fields) {
  const post = getDb().posts.find((p) => p.post_number === number);
  const renamed = "video_name" in fields && fields.video_name !== post.video_name;
  for (const key of OWNER_FIELDS) if (key in fields) post[key] = fields[key];
  saveDb();
  // הנחה: כשהשם משתנה, גם output_id של השורות הקיימות מתעדכן, כי הוא נבנה מהשם
  if (renamed) await renameRows(post);
  return { ...post };
}

// "סיימתי" של יוסי: מסמן את כל הפוסטים במחזור ויוצר את שורות המלל
export async function finishEditing(cycle) {
  const db = getDb();
  const now = new Date().toISOString();
  const cyclePosts = db.posts.filter((p) => p.cycle === cycle);
  for (const p of cyclePosts) {
    p.editing_done = true;
    if (!p.editing_done_at) p.editing_done_at = now;
  }
  saveDb();
  return createRows(cyclePosts.map((p) => p.post_number));
}

// "סיימתי" של שרית: text_done לכל הפוסטים במחזור (אוטומציה 2). יוסי יקבל התראה
export async function finishTexts(cycle) {
  for (const p of getDb().posts.filter((p) => p.cycle === cycle)) p.text_done = true;
  saveDb();
}

// "גמור": לפוסט אחד או לכמה, וגם הסרת הסימון
export async function setFinished(numbers, value) {
  for (const p of getDb().posts.filter((p) => numbers.includes(p.post_number))) p.finished = value;
  saveDb();
}

// ===== מחיקה והעברה של פוסט (ARCHITECTURE סעיף 5, פעולות 7 ו-8) =====
// מותר רק ליוסי, ורק כש-editing_done = false. המספור לא משתנה.

// מחיקה: הפוסט ושורות המלל שלו, כמו on delete cascade
export async function deletePost(number) {
  const db = getDb();
  const index = db.posts.findIndex((p) => p.post_number === number);
  if (index === -1 || db.posts[index].editing_done) throw new Error("אי אפשר למחוק את הפוסט הזה.");
  db.posts.splice(index, 1);
  for (let i = db.texts.length - 1; i >= 0; i--) if (db.texts[i].post_number === number) db.texts.splice(i, 1);
  saveDb();
}

// העברה: רק מספר המחזור משתנה. output_id לא כולל את המחזור, ולכן גם הוא לא משתנה
export async function movePost(number, cycle) {
  const post = getDb().posts.find((p) => p.post_number === number);
  if (!post || post.editing_done) throw new Error("אי אפשר להעביר את הפוסט הזה.");
  post.cycle = cycle;
  saveDb();
}

// המחזורים שאפשר להעביר אליהם: כל המחזורים חוץ מהנוכחי, ומחזור חדש אחרי הגבוה ביותר.
// החלטה של יוסי (1.11.2026), במקום ההנחה ב-DESIGN וב-ARCHITECTURE שהגבילה למחזורים פתוחים.
// פוסט שמועבר למחזור שיוסי כבר סיים מחזיר אותו ל"עריכה והזנה", עד שיוסי ילחץ שוב "סיימתי"
export function moveTargets(posts, current) {
  const cycles = [...new Set(posts.map((p) => p.cycle))].filter((c) => c !== current).sort();
  const top = posts.map((p) => p.cycle).sort().at(-1) || "000";
  const fresh = String(Number(top) + 1).padStart(3, "0");
  return [...cycles.map((cycle) => ({ cycle, isNew: false })), { cycle: fresh, isNew: true }];
}

// ===== המסך: רשימת המחזור =====

export const LENGTHS = ["10", "15", "30", "60"];

function lengthChecks(post, editable) {
  return LENGTHS.map((len) => `
    <label class="check">
      <input type="checkbox" data-field="has_${len}" data-post="${post.post_number}"
             ${post[`has_${len}`] ? "checked" : ""} ${editable ? "" : "disabled"}
             aria-label="פוסט ${post.post_number}, ${len} שניות">
      <span class="check-label">${len}</span>
    </label>`).join("");
}

function imagesCheck(post, editable, withText) {
  return `
    <label class="check">
      <input type="checkbox" data-field="images_ready" data-post="${post.post_number}"
             ${post.images_ready ? "checked" : ""} ${editable ? "" : "disabled"}
             aria-label="פוסט ${post.post_number}, תמונות מוכנות">
      ${withText ? `<span class="check-label">תמונות מוכנות</span>` : ""}
    </label>`;
}

// "גמור" מופיע ליוסי רק בפוסט ששרית כבר סיימה
function finishedCheck(post, withText) {
  if (!post.text_done) return "";
  return `
    <label class="check">
      <input type="checkbox" data-finish="${post.post_number}" ${post.finished ? "checked" : ""}
             aria-label="פוסט ${post.post_number}, גמור">
      ${withText ? `<span class="check-label">גמור</span>` : ""}
    </label>`;
}

function statusCell(post) {
  return `<span data-badge="${post.post_number}">${badge(postStatus(post))}</span>`;
}

// אורך בדקות ושניות: 120 ← "2:00", 90 ← "1:30"
export function minutesText(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// הגרסה הארוכה: תגית עם האורך בדקות, או קו כשאין (DESIGN, מסך 3א)
function longCell(post) {
  return post.yt_long_seconds
    ? `<span class="len-tag" dir="ltr">${minutesText(post.yt_long_seconds)}</span><span class="sr-only"> דקות</span>`
    : `<span aria-hidden="true">—</span><span class="sr-only">אין</span>`;
}

// כפתור שלוש הנקודות: ליוסי בלבד, ורק לפני ה"סיימתי" שלו על הפוסט
function canEdit(post, isOwner) {
  return isOwner && !post.editing_done;
}

function actionsButton(post) {
  return `<button type="button" class="icon-btn act-btn" data-actions="${post.post_number}"
            aria-haspopup="menu" aria-expanded="false" aria-label="פעולות לפוסט ${post.post_number}">${icon("dots")}</button>`;
}

function renderPosts(posts, isOwner) {
  const showFinished = isOwner && posts.some((p) => p.text_done);
  const showActions = posts.some((p) => canEdit(p, isOwner));
  if (!posts.length) {
    return `<p class="empty-state">אין עדיין פוסטים במחזור הזה.${isOwner ? " לחצו \"+ הוספת פוסט\" כדי להתחיל." : ""}</p>`;
  }

  const rows = posts.map((p) => `
    <tr data-href="#/post/${p.post_number}">
      ${showFinished ? `<td class="ck-cell">${finishedCheck(p, false)}</td>` : ""}
      <td class="num" dir="ltr">${p.post_number}</td>
      <td><bdi dir="ltr">${esc(p.video_name)}</bdi></td>
      ${LENGTHS.map((len) => `
        <td class="ck-cell">
          <label class="check">
            <input type="checkbox" data-field="has_${len}" data-post="${p.post_number}"
                   ${p[`has_${len}`] ? "checked" : ""} ${isOwner ? "" : "disabled"}
                   aria-label="פוסט ${p.post_number}, ${len} שניות">
          </label>
        </td>`).join("")}
      <td class="ck-cell">${longCell(p)}</td>
      <td class="ck-cell">${imagesCheck(p, isOwner, false)}</td>
      <td>${statusCell(p)}</td>
      <td class="chev-cell">
        <a class="back-btn" href="#/post/${p.post_number}" aria-label="פתיחת פוסט ${p.post_number}">${icon("forward")}</a>
      </td>
      ${showActions ? `<td class="act-cell">${canEdit(p, isOwner) ? actionsButton(p) : ""}</td>` : ""}
    </tr>`).join("");

  const cards = posts.map((p) => `
    <li class="card post-card">
      <a class="post-card-head" href="#/post/${p.post_number}">
        <span><b dir="ltr">${p.post_number}</b> · <bdi dir="ltr">${esc(p.video_name)}</bdi></span>
        <span class="post-card-end">${statusCell(p)}${icon("forward")}</span>
      </a>
      ${showFinished && p.text_done ? `<div class="check-row finished-row">${finishedCheck(p, true)}</div>` : ""}
      <div class="check-row">${lengthChecks(p, isOwner)}</div>
      <div class="check-row">
        ${imagesCheck(p, isOwner, true)}
        ${p.yt_long_seconds ? `<span class="small">ארוכה: ${longCell(p)}</span>` : ""}
        ${canEdit(p, isOwner) ? `<span class="card-act">${actionsButton(p)}</span>` : ""}
      </div>
    </li>`).join("");

  return `
    <div class="tbl-wrap post-table">
    <table class="tbl">
      <caption class="sr-only">הפוסטים במחזור</caption>
      <thead>
        <tr>
          ${showFinished ? `<th scope="col" rowspan="2" class="ck-cell">גמור</th>` : ""}
          <th scope="col" rowspan="2">מס' פוסט</th><th scope="col" rowspan="2">שם הווידאו</th>
          <th scope="colgroup" colspan="${LENGTHS.length + 1}" class="th-group">גרסאות</th>
          <th scope="col" rowspan="2" class="ck-cell">תמונות</th>
          <th scope="col" rowspan="2">סטטוס</th><th scope="col" rowspan="2"><span class="sr-only">פתיחה</span></th>
          ${showActions ? `<th scope="col" rowspan="2"><span class="sr-only">פעולות</span></th>` : ""}
        </tr>
        <tr class="th-sub">
          ${LENGTHS.map((len) => `<th scope="col" class="ck-cell">${len}</th>`).join("")}
          <th scope="col" class="ck-cell">ארוכה</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    </div>
    <ul class="plain-list post-cards">${cards}</ul>`;
}

// הכפתור בתחתית, לפי המשתמש והשלב (DESIGN, מסך 3א)
function bottomActions(posts, isOwner) {
  if (!posts.length) return "";
  let button = "";
  if (isOwner) {
    // אחרי ששרית סיימה את כל המחזור: "סמן הכל כגמור". לפני כן: "סיימתי"
    button = posts.every((p) => p.text_done)
      ? `<button class="btn btn-secondary" id="finish-all" ${posts.every((p) => p.finished) ? "disabled" : ""}>סמן הכל כגמור</button>`
      : `<button class="btn btn-primary" id="finish-editing">${icon("check")} סיימתי את המחזור</button>`;
  } else if (posts.some((p) => p.editing_done && !p.text_done)) {
    button = `<button class="btn btn-primary" id="finish-texts">${icon("check")} סיימתי את המחזור</button>`;
  }
  return button ? `<div class="bottom-actions">${button}</div>` : "";
}

// פס שלב מתחת לכותרת, עם אותו חישוב כמו בלוח הבקרה (DESIGN מסך 3א).
// הנחה: במחזור חדש, עוד בלי פוסטים, אין פס
function stageHtml(posts) {
  if (!posts.length) return "";
  const c = cycleStage(posts);
  return `${stageBar(c, "bar-small")}<span class="small">${stageText(c)}</span>`;
}

export async function cycleScreen(cycle, user) {
  const posts = await listCycle(cycle);
  const isOwner = user.role === "owner";
  const title = `מחזור ${cycle}`;

  const body = `
    <div class="titlebar">
      <h1 class="page-title" tabindex="-1">מחזור <span dir="ltr">${esc(cycle)}</span></h1>
      ${isOwner ? `<button class="btn btn-primary" id="add-post">+ הוספת פוסט</button>` : ""}
    </div>
    <p class="cycle-stage" id="cycle-stage">${stageHtml(posts)}</p>
    <div class="flash-area">${renderFlash()}</div>
    <div id="post-list">${renderPosts(posts, isOwner)}</div>
    ${bottomActions(posts, isOwner)}`;

  function onMount() {
    const list = $("#post-list");

    // לחיצה על שורה פותחת את הפוסט, חוץ מלחיצה על תיבת סימון או על הקישור
    list.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-href]");
      if (row && !e.target.closest("a, .ck-cell, .act-cell")) location.hash = row.dataset.href;
    });

    // תפריט שלוש הנקודות: "העברה למחזור אחר" ו"מחיקת פוסט"
    list.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-actions]");
      if (!btn) return;
      // לחיצה שנייה על הכפתור סוגרת את התפריט
      if (btn.getAttribute("aria-expanded") === "true") return closeActions();
      const post = posts.find((p) => p.post_number === btn.dataset.actions);
      openActions(btn, [
        { icon: "move", label: "העברה למחזור אחר", run: () => openMovePost(post) },
        { icon: "trash", label: "מחיקת פוסט", run: () => openDeletePost(post) },
      ]);
    });

    // שינוי באורכים, בתמונות או ב"גמור" נשמר מיד. בטבלה ובכרטיסים יש אותה תיבה פעמיים, ושתיהן מתעדכנות
    list.addEventListener("change", async (e) => {
      const finish = e.target.closest("input[data-finish]");
      if (finish) {
        const number = finish.dataset.finish;
        await setFinished([number], finish.checked);
        const post = posts.find((p) => p.post_number === number);
        post.finished = finish.checked;
        $$(`input[data-finish="${number}"]`, list).forEach((b) => { b.checked = finish.checked; });
        $$(`[data-badge="${number}"]`, list).forEach((el) => { el.innerHTML = badge(postStatus(post)); });
        const all = $("#finish-all");
        if (all) all.disabled = posts.every((p) => p.finished);
        $("#cycle-stage").innerHTML = stageHtml(posts);
        return;
      }
      const box = e.target.closest("input[data-field]");
      if (!box) return;
      const { post, field } = box.dataset;
      await updatePost(post, { [field]: box.checked });
      $$(`input[data-post="${post}"][data-field="${field}"]`, list).forEach((b) => { b.checked = box.checked; });
      // סימון אורך משנה את ההתקדמות של "עריכה והזנה" בפס
      const changed = posts.find((p) => p.post_number === post);
      if (changed) changed[field] = box.checked;
      $("#cycle-stage").innerHTML = stageHtml(posts);
    });

    $("#add-post")?.addEventListener("click", () => openNewPost(cycle));

    $("#finish-editing")?.addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      const { created, noRows } = await finishEditing(cycle);
      const flash = [{
        kind: "ok",
        html: created
          ? `סיימתם את המחזור. נוצרו ${created} שורות מלל, ושרית תקבל משימה.`
          : "סיימתם את המחזור. כל שורות המלל כבר קיימות, ולא נוצרו שורות חדשות.",
      }];
      if (noRows.length) {
        const many = noRows.length > 1;
        flash.push({
          kind: "err",
          html: `לא נוצרו שורות מלל ל${many ? "פוסטים" : "פוסט"}
            ${noRows.map((p) => `<b dir="ltr">${p.post_number}</b> (<bdi dir="ltr">${esc(p.video_name)}</bdi>)`).join(", ")},
            כי לא סומנו ${many ? "להם" : "לו"} אורכים או "תמונות מוכנות". אפשר לסמן וללחוץ שוב על "סיימתי".`,
        });
      }
      setFlash(flash);
      rerender();
    });

    $("#finish-all")?.addEventListener("click", async () => {
      await setFinished(posts.map((p) => p.post_number), true);
      setFlash([{ kind: "ok", html: "כל הפוסטים במחזור סומנו כגמורים. אפשר להסיר סימון מפוסט שעוד בעבודה." }]);
      rerender();
    });

    $("#finish-texts")?.addEventListener("click", () => {
      const done = async () => {
        await finishTexts(cycle);
        setFlash([{ kind: "ok", html: "סיימת את המחזור. יוסי יקבל התראה." }]);
        rerender();
      };
      // הנחה: אם יש פוסטים שעוד לא אושרו, שואלים לפני שמסיימים
      const waiting = posts.filter((p) => p.editing_done && p.status !== "approved");
      if (!waiting.length) return done();
      openModal({
        title: "לסיים את המחזור?",
        body: `<p>${waiting.length === 1 ? "פוסט אחד עוד לא אושר" : `${waiting.length} פוסטים עוד לא אושרו`}:
               ${waiting.map((p) => `<b><bdi>${p.post_number}</bdi></b>`).join(", ")}. לסיים בכל זאת?</p>`,
        primary: "לסיים",
        onSubmit: () => { done(); },
      });
    });
  }

  return { title, back: listOrigin(), body, onMount };
}

// ===== השדות של יוסי: קריאה ובדיקה =====
// משותף לחלון "פוסט חדש" ולמסך הפוסט. בטופס יש name-field / name-err ו-yt-field / yt-err.
// מחזיר את השדות, או null אם יש שגיאה (והשגיאה מוצגת ליד השדה).

export function readOwnerFields(form) {
  const el = form.elements;
  const name = el.video_name.value.trim();
  const ytRaw = el.yt_long_seconds.value.trim();
  const yt = ytRaw === "" ? null : Number(ytRaw);

  const errors = {
    name: name ? "" : "צריך למלא את שם הווידאו.",
    yt: yt === null || (Number.isInteger(yt) && yt > 0) ? "" : "אורך יוטיוב צריך להיות מספר שלם וגדול מאפס.",
  };
  for (const key of ["name", "yt"]) {
    $(`#${key}-field`, form).classList.toggle("is-error", !!errors[key]);
    $(`#${key}-err`, form).textContent = errors[key];
  }
  if (errors.name) { el.video_name.focus(); return null; }
  if (errors.yt) { el.yt_long_seconds.focus(); return null; }

  return {
    video_name: name,
    ...Object.fromEntries(LENGTHS.map((len) => [`has_${len}`, el[`has_${len}`].checked])),
    yt_long_seconds: yt,
    images_ready: el.images_ready.checked,
  };
}

// ===== חלון: פוסט חדש =====

function openNewPost(cycle) {
  const { form } = openModal({
    title: "פוסט חדש",
    primary: "יצירה",
    body: `
      <div class="field" id="name-field">
        <label for="video-name">שם הווידאו</label>
        <input class="input" id="video-name" name="video_name" dir="ltr" lang="en" autocomplete="off"
               aria-describedby="name-err">
        <p class="field-error" id="name-err" role="alert"></p>
      </div>
      <fieldset class="field fieldset">
        <legend class="field-label">אילו אורכים הכנתם?</legend>
        <div class="check-row">
          ${LENGTHS.map((len) => `
            <label class="check"><input type="checkbox" name="has_${len}"> <span>${len}</span></label>`).join("")}
        </div>
      </fieldset>
      <div class="field" id="yt-field">
        <label for="yt-long">אורך יוטיוב (שניות)</label>
        <input class="input" id="yt-long" name="yt_long_seconds" type="number" min="1" step="1"
               inputmode="numeric" dir="ltr" aria-describedby="yt-err">
        <p class="field-hint" id="yt-min" aria-live="polite"></p>
        <p class="field-error" id="yt-err" role="alert"></p>
      </div>
      <label class="check"><input type="checkbox" name="images_ready"> <span>תמונות מוכנות</span></label>`,
    async onSubmit(form) {
      const fields = readOwnerFields(form);
      if (!fields) return false;
      const post = await addPost(cycle, fields);
      setFlash([{ kind: "ok", html: `הפוסט <b dir="ltr">${post.post_number}</b> נוסף למחזור.` }]);
      rerender();
    },
  });

  // מתחת לשדה השניות מוצג האורך בדקות, כשיש בו מספר תקין
  const yt = form.elements.yt_long_seconds;
  yt.addEventListener("input", () => {
    const value = Number(yt.value);
    $("#yt-min", form).innerHTML = Number.isInteger(value) && value > 0
      ? `<span class="len-tag" dir="ltr">${minutesText(value)}</span> דקות`
      : "";
  });
}

// ===== תפריט הפעולות של פוסט =====
// התפריט נפתח מתחת לכפתור, ויושב ב-body כדי שהגלילה של הטבלה לא תחתוך אותו.
// מקלדת: חצים למעלה ולמטה, Esc סוגר ומחזיר לכפתור, Tab סוגר.

function openActions(btn, items) {
  closeActions();
  const menu = document.createElement("div");
  menu.className = "menu act-menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", btn.getAttribute("aria-label"));
  menu.innerHTML = items.map((item, i) =>
    `<button type="button" role="menuitem" data-i="${i}" tabindex="-1">${icon(item.icon)} ${item.label}</button>`).join("");
  document.body.append(menu);
  btn.setAttribute("aria-expanded", "true");

  // המיקום: מתחת לכפתור, ומעליו אם אין מקום. הקצה של התפריט מיושר לקצה של הכפתור
  const r = btn.getBoundingClientRect();
  const below = r.bottom + 6 + menu.offsetHeight <= innerHeight;
  menu.style.top = `${below ? r.bottom + 6 : r.top - 6 - menu.offsetHeight}px`;
  menu.style.left = `${Math.max(8, Math.min(r.left, innerWidth - menu.offsetWidth - 8))}px`;

  const buttons = $$("button", menu);
  buttons[0].focus();

  const close = (refocus) => {
    menu.remove();
    btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onOutside, true);
    removeEventListener("scroll", onMove, true);
    removeEventListener("resize", onMove);
    activeClose = null;
    if (refocus) btn.focus();
  };
  const onOutside = (e) => { if (!menu.contains(e.target) && e.target.closest("button") !== btn) close(false); };
  const onMove = () => close(false);
  activeClose = close;

  menu.addEventListener("keydown", (e) => {
    const i = buttons.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); buttons[(i + 1) % buttons.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length].focus(); }
    else if (e.key === "Escape") { e.preventDefault(); close(true); }
    else if (e.key === "Tab") close(true);
  });
  menu.addEventListener("click", (e) => {
    const item = e.target.closest("button[data-i]");
    if (!item) return;
    // החלון שנפתח מחזיר את המיקוד לכפתור כשהוא נסגר
    close(true);
    items[item.dataset.i].run();
  });
  document.addEventListener("pointerdown", onOutside, true);
  addEventListener("scroll", onMove, true);
  addEventListener("resize", onMove);
}

let activeClose = null;
function closeActions() {
  activeClose?.(false);
}

// ===== חלון: העברת פוסט (DESIGN, מסך 3א) =====

async function openMovePost(post) {
  const targets = moveTargets(await listPosts(), post.cycle);
  openModal({
    title: `העברת פוסט ${post.post_number}`,
    primary: "העברה",
    body: `
      <div class="field">
        <label for="move-target">למחזור</label>
        <select class="select" id="move-target" name="target" aria-describedby="move-hint">
          ${targets.map((t) => `<option value="${t.cycle}">${t.cycle}${t.isNew ? " (מחזור חדש)" : ""}</option>`).join("")}
        </select>
        <p class="field-hint" id="move-hint">מספר הפוסט לא משתנה.</p>
      </div>`,
    async onSubmit(form) {
      const target = form.elements.target.value;
      await movePost(post.post_number, target);
      setFlash([{ kind: "ok", html: `הפוסט <b dir="ltr">${post.post_number}</b> הועבר למחזור <b dir="ltr">${target}</b>` }]);
      rerender();
    },
  });
}

// ===== חלון: מחיקת פוסט (DESIGN, מסך 3א) =====

function openDeletePost(post) {
  const { form } = openModal({
    title: `למחוק את פוסט ${post.post_number}?`,
    primary: "מחיקה",
    primaryClass: "btn-alert",
    body: `<p>הפוסט ושורות המלל שלו יימחקו, ואי אפשר לבטל את זה.</p>`,
    async onSubmit() {
      await deletePost(post.post_number);
      setFlash([{ kind: "ok", html: `הפוסט <b dir="ltr">${post.post_number}</b> נמחק` }]);
      rerender();
    },
  });
  // הנחה: המיקוד מתחיל ב"ביטול", כדי ש-Enter לא ימחק בטעות
  $(".modal-cancel", form).focus();
}
