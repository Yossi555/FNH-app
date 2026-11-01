// יוסי: מחזורים ופוסטים, והמסך "משימה בודדת: רשימת המחזור".
// כל הפונקציות כאן אסינכרוניות, כמו קריאות ל-Supabase. באב הטיפוס הן עובדות מול js/mock/store.js.

import { getDb, saveDb } from "./mock/store.js";
import { START_POST_NUMBER } from "./config.js";
import { createRows, renameRows } from "./rows.js";
import { esc, icon, badge, openModal, rerender, listOrigin, setFlash, renderFlash, $, $$ } from "./ui.js";

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

function ytText(post) {
  return post.yt_long_seconds ? `<span dir="ltr">${post.yt_long_seconds}</span>` : "";
}

function renderPosts(posts, isOwner) {
  const showFinished = isOwner && posts.some((p) => p.text_done);
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
      <td>${ytText(p)}</td>
      <td class="ck-cell">${imagesCheck(p, isOwner, false)}</td>
      <td>${statusCell(p)}</td>
      <td class="chev-cell">
        <a class="back-btn" href="#/post/${p.post_number}" aria-label="פתיחת פוסט ${p.post_number}">${icon("forward")}</a>
      </td>
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
        ${p.yt_long_seconds ? `<span class="small muted-text">יוטיוב: ${ytText(p)} שניות</span>` : ""}
      </div>
    </li>`).join("");

  return `
    <div class="tbl-wrap post-table">
    <table class="tbl">
      <caption class="sr-only">הפוסטים במחזור</caption>
      <thead><tr>
        ${showFinished ? `<th scope="col" class="ck-cell">גמור</th>` : ""}
        <th scope="col">מס' פוסט</th><th scope="col">שם הווידאו</th>
        ${LENGTHS.map((len) => `<th scope="col" class="ck-cell">${len}</th>`).join("")}
        <th scope="col">יוטיוב (שניות)</th><th scope="col" class="ck-cell">תמונות</th>
        <th scope="col">סטטוס</th><th scope="col"><span class="sr-only">פתיחה</span></th>
      </tr></thead>
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

export async function cycleScreen(cycle, user) {
  const posts = await listCycle(cycle);
  const isOwner = user.role === "owner";
  const title = `מחזור ${cycle}`;

  const body = `
    <div class="titlebar">
      <h1 class="page-title" tabindex="-1">מחזור <span dir="ltr">${esc(cycle)}</span></h1>
      ${isOwner ? `<button class="btn btn-primary" id="add-post">+ הוספת פוסט</button>` : ""}
    </div>
    <div class="flash-area">${renderFlash()}</div>
    <div id="post-list">${renderPosts(posts, isOwner)}</div>
    ${bottomActions(posts, isOwner)}`;

  function onMount() {
    const list = $("#post-list");

    // לחיצה על שורה פותחת את הפוסט, חוץ מלחיצה על תיבת סימון או על הקישור
    list.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-href]");
      if (row && !e.target.closest("a, .ck-cell")) location.hash = row.dataset.href;
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
        return;
      }
      const box = e.target.closest("input[data-field]");
      if (!box) return;
      const { post, field } = box.dataset;
      await updatePost(post, { [field]: box.checked });
      $$(`input[data-post="${post}"][data-field="${field}"]`, list).forEach((b) => { b.checked = box.checked; });
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
  openModal({
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
}
