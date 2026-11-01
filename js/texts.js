// שורות המלל של פוסט, והמסך "משימה בודדת: פוסט".
// יוסי: עדכון גרסאות, צפייה במלל והעתקה.
// שרית: הנחיה, דף נחיתה, הפעלת המודל, עריכה, "נסה שוב" ואישור (ARCHITECTURE סעיף 5, אוטומציות 3–6).

import { getDb, saveDb } from "./mock/store.js";
import { getPost, listCycle, postStatus, updatePost, readOwnerFields, LENGTHS } from "./posts.js";
import { loadNetworks } from "./rows.js";
import { relevantNetworks } from "../shared/relevance.js";
import { loadLinks, variableLinks, renderLinks, resolveLinks, hasMissingLink } from "./links.js";
import { generatePost, generateField, demoFailure } from "./ai.js";
import { esc, icon, badge, openModal, copyButton, handleCopy, rerender, listOrigin, setFlash, renderFlash, $, $$ } from "./ui.js";

// ===== נתונים =====

export async function listTexts(number) {
  return getDb().texts.filter((t) => t.post_number === number).map((t) => structuredClone(t));
}

function dbPost(number) {
  return getDb().posts.find((p) => p.post_number === number);
}

function dbRow(id) {
  return getDb().texts.find((t) => t.id === id);
}

function readValue(row, version, field) {
  return (version ? row.versions[version]?.[field] : row[field]) || "";
}

function writeValue(row, version, field, value) {
  if (version) row.versions[version] = { ...row.versions[version], [field]: value };
  else row[field] = value;
  row.updated_at = new Date().toISOString();
}

// השדות של שרית בפוסט: prompt ו-landing_page
export async function updatePostTexts(number, fields) {
  const post = dbPost(number);
  for (const key of ["prompt", "landing_page"]) if (key in fields) post[key] = fields[key];
  saveDb();
}

// עריכה ידנית: שומרים ומוסיפים 1 ל-manual_edit_count (אוטומציה 5)
export async function saveField(rowId, version, field, value) {
  const row = dbRow(rowId);
  writeValue(row, version, field, value);
  row.manual_edit_count += 1;
  saveDb();
}

function linkIdsOf(network) {
  return [...(network.links.variable ? ["landing"] : []), ...network.links.fixed];
}

// targets לפי shared/relevance.js, רק לרשתות שיש להן שורה (ARCHITECTURE סעיף 4)
function buildTargets(post, rows, networks) {
  return relevantNetworks(post, networks)
    .filter(({ network }) => rows.some((r) => r.network === network.id))
    .map(({ network, versions }) => ({
      network: network.id,
      versions,
      version_fields: network.version_fields,
      fields: network.fields,
      link_ids: linkIdsOf(network),
    }));
}

// הפעלת המודל על פוסט (אוטומציה 3). בכשל לא משתנה אף שדה
export async function runModel(number) {
  const post = dbPost(number);
  const networks = await loadNetworks();
  const rows = getDb().texts.filter((t) => t.post_number === number);
  const targets = buildTargets(post, rows, networks);
  if (!targets.length) throw new Error("אין לפוסט גרסאות שאפשר לכתוב להן מלל.");

  const result = await generatePost({
    post_number: number, video_name: post.video_name, prompt: post.prompt,
    yt_long_seconds: post.yt_long_seconds, targets,
  });

  for (const target of targets) {
    const out = result[target.network];
    const row = rows.find((r) => r.network === target.network);
    for (const [version, values] of Object.entries(out.versions || {})) row.versions[version] = { ...values };
    for (const field of target.fields) row[field] = out[field] ?? "";
    row.updated_at = new Date().toISOString();
  }
  post.status = "draft";
  saveDb();
}

// "נסה שוב" על שדה (אוטומציה 4). מחזיר את הערך החדש
export async function retryField(rowId, version, field, note) {
  const row = dbRow(rowId);
  const post = dbPost(row.post_number);
  const network = (await loadNetworks()).find((n) => n.id === row.network);
  const value = await generateField({
    post_number: post.post_number, video_name: post.video_name, prompt: post.prompt,
    yt_long_seconds: post.yt_long_seconds,
    network: row.network, version: version || null, field,
    current_value: readValue(row, version, field), note, link_ids: linkIdsOf(network),
  });
  writeValue(row, version, field, value);
  row.retry_count += 1;
  saveDb();
  return value;
}

// אישור פוסט (אוטומציה 6)
export async function approvePost(number) {
  const post = dbPost(number);
  post.status = "approved";
  post.approved_at = new Date().toISOString();
  saveDb();
}

// ===== השדות שמוצגים בכל לשונית =====

const FIELD_LABELS = {
  on_screen_text: "טקסט על הווידאו",
  voiceover: "קריינות",
  on_image_text: "טקסט על התמונה",
  title: "כותרת",
  description: "תיאור",
  tags: "תגיות",
  pinned_comment: "תגובה נעוצה",
  thumbnail_description_he: "תיאור תמונה ממוזערת",
};

// השדות שכתובים בעברית. כל השאר באנגלית, משמאל לימין
const HEBREW_FIELDS = ["thumbnail_description_he"];

function versionLabel(version, post) {
  if (version === "long") {
    // הנחה: כך נקראת הגרסה הארוכה של יוטיוב במסך
    return post.yt_long_seconds ? `גרסה ארוכה, ${post.yt_long_seconds} שניות` : "גרסה ארוכה";
  }
  if (version.startsWith("img")) return `תמונה ${version.slice(3)}`;
  return `${version} שניות`;
}

// רשימה שטוחה של השדות בשורה: קודם השדות לפי גרסה, אחר כך השדות המשותפים
function fieldsOf(row, network, post) {
  const items = [];
  for (const version of Object.keys(row.versions)) {
    for (const field of network.version_fields) {
      items.push({
        version, field,
        label: `${FIELD_LABELS[field]} – ${versionLabel(version, post)}`,
        value: readValue(row, version, field),
      });
    }
  }
  for (const field of network.fields) {
    items.push({ version: null, field, label: FIELD_LABELS[field], value: readValue(row, null, field) });
  }
  return items;
}

// השם הקצר בלשונית, בלי ההערה שבסוגריים
function tabName(network) {
  return network.name_he.replace(/\s*\(.*\)$/, "");
}

// ===== המסך =====

let activeTab = null;
// כשל של המודל נשאר מוצג עד הפעלה מוצלחת, או עד מעבר לפוסט אחר
let aiError = null;

function navArrows(siblings, index) {
  const prev = siblings[index - 1];
  const next = siblings[index + 1];
  const arrow = (post, name, label) => post
    ? `<a class="icon-btn" href="#/post/${post.post_number}" aria-label="${label}: ${post.post_number}">${icon(name)}</a>`
    : `<span class="icon-btn is-disabled" aria-hidden="true">${icon(name)}</span>`;
  return `
    <nav class="post-nav" aria-label="מעבר בין הפוסטים במחזור">
      ${arrow(prev, "back", "הפוסט הקודם")}
      <span class="small muted-text">${index + 1} מתוך ${siblings.length}</span>
      ${arrow(next, "forward", "הפוסט הבא")}
    </nav>`;
}

function detailsCard(post, isOwner, links, canRun) {
  const dis = isOwner ? "" : "disabled";
  const landing = links.find((l) => l.id === post.landing_page);

  const landingField = isOwner
    ? `<span class="field-label">דף נחיתה</span>
       <p class="readonly-value">${landing ? esc(landing.name) : `<span class="muted-text">עוד לא נבחר</span>`}</p>`
    : `<label for="landing">דף נחיתה</label>
       <select class="select" id="landing" name="landing_page">
         <option value="">בחר דף נחיתה</option>
         ${variableLinks(links).map((l) => `
           <option value="${esc(l.id)}" ${l.id === post.landing_page ? "selected" : ""}>${esc(l.name)}</option>`).join("")}
       </select>`;

  const promptField = isOwner
    ? `<span class="field-label">הנחיה ל-AI</span>
       <p class="readonly-value" dir="auto">${post.prompt ? esc(post.prompt) : `<span class="muted-text">עוד אין הנחיה</span>`}</p>`
    : `<label for="prompt">הנחיה ל-AI</label>
       <textarea class="textarea" id="prompt" name="prompt" dir="auto" aria-describedby="prompt-hint">${esc(post.prompt)}</textarea>
       <p class="small muted-text" id="prompt-hint">תארי את הפוסט. בלי תיאור אי אפשר להפעיל את המודל.</p>`;

  const actions = isOwner
    ? `<div class="form-actions"><button class="btn btn-primary" type="submit">שמירה</button></div>`
    : `<div class="form-actions ai-actions">
         <label class="check proto-toggle">
           <input type="checkbox" id="demo-fail" ${demoFailure.get() ? "checked" : ""}>
           <span>אב טיפוס: הדגמת שגיאה</span>
         </label>
         <button class="btn btn-ai" type="button" id="run-ai" ${canRun && post.prompt.trim() ? "" : "disabled"}>
           ${icon("sparkle")} הפעלת המודל
         </button>
       </div>`;

  return `
    <form class="card post-details" id="post-form" novalidate>
      <h2 class="h4">פרטי הפוסט</h2>
      <div class="details-grid">
        <fieldset class="field fieldset">
          <legend class="field-label">גרסאות שהכנת</legend>
          <div class="check-row">
            ${LENGTHS.map((len) => `
              <label class="check"><input type="checkbox" name="has_${len}" ${post[`has_${len}`] ? "checked" : ""} ${dis}> <span>${len}</span></label>`).join("")}
          </div>
        </fieldset>
        <div class="field" id="yt-field">
          <label for="yt-long">אורך יוטיוב (שניות)</label>
          <input class="input" id="yt-long" name="yt_long_seconds" type="number" min="1" step="1" inputmode="numeric"
                 dir="ltr" value="${post.yt_long_seconds ?? ""}" aria-describedby="yt-err" ${dis}>
          <p class="field-error" id="yt-err" role="alert"></p>
        </div>
        <div class="field">
          <span class="field-label" aria-hidden="true">תמונות</span>
          <label class="check"><input type="checkbox" name="images_ready" ${post.images_ready ? "checked" : ""} ${dis}> <span>תמונות מוכנות</span></label>
        </div>
        <div class="field" id="name-field">
          <label for="video-name">שם הווידאו</label>
          <input class="input" id="video-name" name="video_name" dir="ltr" lang="en" autocomplete="off"
                 value="${esc(post.video_name)}" aria-describedby="name-err" ${dis}>
          <p class="field-error" id="name-err" role="alert"></p>
        </div>
        <div class="field">${landingField}</div>
        <div class="field field-wide">${promptField}</div>
      </div>
      ${actions}
    </form>`;
}

// שדה מלל ליוסי: תיבה לקריאה עם הלינקים האמיתיים, וכפתור העתקה
function ownerField(item, post, links, ids) {
  const content = item.value
    ? renderLinks(item.value, post, links)
    : `<span class="text-empty" dir="rtl" lang="he">עוד אין מלל</span>`;
  return `
    <div class="text-box" id="${ids.box}" role="textbox" aria-readonly="true" aria-multiline="true"
         aria-labelledby="${ids.label}" dir="${ids.dir}" lang="${ids.lang}">${content}</div>
    ${copyButton(item.label, `${ids.key} ${item.value ? "" : "disabled"}`)}`;
}

// הרקע של שדה העריכה: אותו טקסט בדיוק, שקוף, וסימון בלי כתובת מודגש מתחתיו.
// רווח בסוף שומר על הגובה כשהטקסט ריק או נגמר בשורה ריקה
function backdropHtml(value, post, links) {
  const tail = !value || value.endsWith("\n") ? " " : "";
  return renderLinks(value, post, links, { raw: true }) + tail;
}

// שדה מלל לשרית: שדה עריכה, ולידו "נסה שוב" (או ✓ אחרי האישור)
function editorField(item, post, links, ids, approved) {
  const side = approved
    ? `<span class="icon-btn is-ok" role="img" aria-label="מאושר">${icon("check")}</span>`
    : `<button type="button" class="icon-btn retry-btn" aria-label="נסה שוב: ${esc(item.label)}"
               aria-expanded="false" aria-controls="${ids.box}-retry">${icon("retry")}</button>`;
  return `
    <div class="hl-wrap">
      <div class="hl-backdrop" aria-hidden="true" dir="${ids.dir}">${backdropHtml(item.value, post, links)}</div>
      <textarea class="hl-input" id="${ids.box}" ${ids.key} rows="1" aria-labelledby="${ids.label}"
                dir="${ids.dir}" lang="${ids.lang}">${esc(item.value)}</textarea>
    </div>
    ${side}`;
}

function retryBox(ids) {
  return `
    <div class="retry-box" id="${ids.box}-retry" hidden>
      <label for="${ids.box}-note" class="small">הערה (לא חובה)</label>
      <div class="retry-row">
        <input class="input" id="${ids.box}-note" dir="auto" autocomplete="off">
        <button type="button" class="btn btn-ai rewrite-btn" ${ids.key}>כתוב מחדש</button>
      </div>
      <p class="field-error" role="alert"></p>
    </div>`;
}

function textField(item, row, post, links, isOwner, approved) {
  const box = `f-${row.network}-${item.version || "x"}-${item.field}`;
  const he = HEBREW_FIELDS.includes(item.field);
  const ids = {
    box, label: `${box}-label`,
    dir: he ? "rtl" : "ltr", lang: he ? "he" : "en",
    key: `data-row="${row.id}" data-version="${item.version || ""}" data-field="${item.field}"`,
  };
  return `
    <div class="tfield">
      <span class="field-label" id="${ids.label}">${esc(item.label)}</span>
      <div class="tfield-row">
        ${isOwner ? ownerField(item, post, links, ids) : editorField(item, post, links, ids, approved)}
      </div>
      ${isOwner || approved ? "" : retryBox(ids)}
    </div>`;
}

function anyMissing(rows, networks, post, links) {
  return rows.some((row) =>
    fieldsOf(row, networks.find((n) => n.id === row.network), post).some((f) => hasMissingLink(f.value, post, links)));
}

function textsBody(rows, networks, post, links, isOwner) {
  if (!rows.length) {
    return `<p class="empty-state">${post.editing_done
      ? "לפוסט הזה אין שורות מלל, כי לא סומנו לו גרסאות או תמונות."
      : "עוד אין מלל. השורות ייווצרו אחרי \"סיימתי\" של יוסי ברשימת המחזור."}</p>`;
  }

  const tabs = networks
    .map((network) => ({ network, row: rows.find((r) => r.network === network.id) }))
    .filter((t) => t.row);
  if (!tabs.some((t) => t.network.id === activeTab)) activeTab = tabs[0].network.id;
  const approved = post.status === "approved";

  return `
    ${aiError && !isOwner ? `
      <div class="banner banner-err ai-error" role="alert">${icon("alert")}
        <div class="ai-error-text">${esc(aiError.message)} שום שדה לא השתנה.</div>
        <button type="button" class="btn btn-secondary" id="ai-retry">${icon("retry")} נסה שוב</button>
      </div>` : ""}
    <div class="banner banner-err small" role="note" id="missing-link" ${anyMissing(rows, networks, post, links) ? "" : "hidden"}>
      ${icon("alert")}
      <div>עוד לא נבחר דף נחיתה, ולכן הסימון המודגש נשאר בטקסט. אחרי הבחירה הוא יוחלף בלינק.</div>
    </div>
    <div class="tabs" role="tablist" aria-label="רשתות">
      ${tabs.map(({ network }) => `
        <button type="button" class="tab" role="tab" id="tab-${network.id}" aria-controls="panel-${network.id}"
                aria-selected="${network.id === activeTab}" tabindex="${network.id === activeTab ? 0 : -1}"
                data-tab="${network.id}">${esc(tabName(network))}</button>`).join("")}
    </div>
    ${tabs.map(({ network, row }) => `
      <div class="tab-panel" role="tabpanel" id="panel-${network.id}" aria-labelledby="tab-${network.id}"
           ${network.id === activeTab ? "" : "hidden"}>
        <p class="small muted-text">${esc(network.name_he)} · שם הקובץ: <bdi class="file-id" dir="ltr">${esc(row.output_id)}</bdi></p>
        ${fieldsOf(row, network, post).map((item) => textField(item, row, post, links, isOwner, approved)).join("")}
      </div>`).join("")}
    ${isOwner ? "" : `
      <div class="bottom-actions">
        ${approved
          ? `<p class="approved-note">${icon("check")} הפוסט אושר</p>`
          : `<button type="button" class="btn btn-success" id="approve">${icon("check")} אישור הפוסט</button>`}
      </div>`}`;
}

function loadingHtml() {
  return `
    <div class="card ai-loading" role="status">
      <span class="spinner" aria-hidden="true"></span>
      <p><b>יוצרים תוכן עם AI...</b> זה יכול לקחת כמה רגעים</p>
    </div>
    <div class="skeleton" aria-hidden="true">${"<span></span>".repeat(6)}</div>`;
}

export async function postScreen(number, user) {
  const post = await getPost(number);
  if (!post) {
    return {
      title: "הפוסט לא נמצא",
      back: listOrigin(),
      body: `<div class="titlebar"><h1 class="page-title" tabindex="-1">הפוסט לא נמצא</h1></div>
             <p class="empty-state">אין פוסט עם המספר הזה.</p>`,
    };
  }

  const isOwner = user.role === "owner";
  const [siblings, rows, networks, links] = await Promise.all([
    listCycle(post.cycle), listTexts(number), loadNetworks(), loadLinks(),
  ]);
  const index = siblings.findIndex((p) => p.post_number === number);
  if (aiError && aiError.number !== number) aiError = null;

  const body = `
    <div class="titlebar">
      <h1 class="page-title" tabindex="-1">פוסט <span dir="ltr">${esc(number)}</span></h1>
      ${navArrows(siblings, index)}
    </div>
    <div class="flash-area">${renderFlash()}</div>
    <div class="status-row">
      ${badge(postStatus(post))}
      <span class="small muted-text"><bdi dir="ltr">${esc(post.video_name)}</bdi> · מחזור <span dir="ltr">${esc(post.cycle)}</span></span>
    </div>
    ${detailsCard(post, isOwner, links, rows.length > 0)}
    <section class="texts" aria-labelledby="texts-title">
      <h2 class="h4" id="texts-title">מלל</h2>
      <div id="texts-body">${textsBody(rows, networks, post, links, isOwner)}</div>
    </section>
    <p class="sr-only" role="status" id="sr-status"></p>`;

  const say = (text) => { $("#sr-status").textContent = text; };
  const findRow = (id) => rows.find((r) => r.id === id);

  function bindTabs() {
    // ב-RTL החץ שמאלה מוביל ללשונית הבאה
    const tabButtons = $$(".tab");
    function selectTab(btn, focus) {
      activeTab = btn.dataset.tab;
      tabButtons.forEach((b) => {
        const on = b === btn;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
        $(`#panel-${b.dataset.tab}`).hidden = !on;
      });
      if (focus) btn.focus();
    }
    tabButtons.forEach((btn, i) => {
      btn.addEventListener("click", () => selectTab(btn, false));
      btn.addEventListener("keydown", (e) => {
        const step = { ArrowLeft: 1, ArrowRight: -1 }[e.key];
        let target = null;
        if (step) target = tabButtons[(i + step + tabButtons.length) % tabButtons.length];
        if (e.key === "Home") target = tabButtons[0];
        if (e.key === "End") target = tabButtons.at(-1);
        if (target) { e.preventDefault(); selectTab(target, true); }
      });
    });
  }

  function bindOwner() {
    $("#post-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fields = readOwnerFields(e.currentTarget);
      if (!fields) return;
      const lengthsChanged = [...LENGTHS.map((l) => `has_${l}`), "yt_long_seconds", "images_ready"]
        .some((k) => fields[k] !== post[k]);
      await updatePost(number, fields);
      const flash = [{ kind: "ok", html: "השינויים נשמרו." }];
      if (lengthsChanged && post.editing_done) {
        flash.push({
          kind: "info",
          html: "שורות המלל הקיימות לא משתנות. כדי ליצור שורות שחסרות, לוחצים שוב על \"סיימתי\" ברשימת המחזור.",
        });
      }
      setFlash(flash);
      rerender();
    });

    // העתקה: הטקסט עם הכתובות האמיתיות במקום הסימונים
    $$(".copy-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        const { row, version, field } = btn.dataset;
        handleCopy(btn, resolveLinks(readValue(findRow(row), version, field), post, links), $("#sr-status"));
      }),
    );
  }

  function bindEditor() {
    const runBtn = $("#run-ai");
    const prompt = $("#prompt");

    // הרקעים של כל שדות העריכה, אחרי שינוי בטקסט או בדף הנחיתה
    function refreshHighlights() {
      $$(".hl-input").forEach((ta) => {
        ta.previousElementSibling.innerHTML = backdropHtml(ta.value, post, links);
      });
      const banner = $("#missing-link");
      if (banner) banner.hidden = !$$(".hl-input").some((ta) => hasMissingLink(ta.value, post, links));
    }

    async function savePrompt() {
      if (prompt.value === post.prompt) return;
      post.prompt = prompt.value;
      await updatePostTexts(number, { prompt: post.prompt });
    }

    prompt.addEventListener("input", () => { runBtn.disabled = !rows.length || !prompt.value.trim(); });
    prompt.addEventListener("blur", savePrompt);

    $("#landing").addEventListener("change", async (e) => {
      post.landing_page = e.target.value || null;
      await updatePostTexts(number, { landing_page: post.landing_page });
      refreshHighlights();
      say(post.landing_page ? "דף הנחיתה נשמר." : "דף הנחיתה הוסר.");
    });

    $("#demo-fail").addEventListener("change", (e) => demoFailure.set(e.target.checked));

    async function start() {
      await savePrompt();
      runBtn.disabled = true;
      const textsBodyEl = $("#texts-body");
      textsBodyEl.innerHTML = loadingHtml();
      textsBodyEl.setAttribute("aria-busy", "true");
      try {
        await runModel(number);
        aiError = null;
        setFlash([{ kind: "ok", html: "המלל נוצר, והסטטוס עכשיו טיוטה. אפשר לעבור על השדות ולתקן." }]);
      } catch (error) {
        aiError = { number, message: error.message };
      }
      // אם בזמן הטעינה עברו למסך אחר, לא מציירים מחדש
      if (location.hash === `#/post/${number}`) rerender();
    }

    runBtn.addEventListener("click", () => {
      if (!prompt.value.trim()) return;
      const hasText = $$(".hl-input").some((ta) => ta.value.trim());
      if (!hasText) return start();
      openModal({
        title: "להפעיל שוב את המודל?",
        body: `<p>התיקונים שלך יימחקו. להמשיך?</p>`,
        primary: "להמשיך",
        primaryClass: "btn-alert",
        onSubmit: () => { start(); },
      });
    });

    // "נסה שוב" אחרי כשל: בלי חלון אישור, כי ההפעלה שנכשלה כבר אושרה
    $("#ai-retry")?.addEventListener("click", start);

    // עריכה ידנית: נשמרת כשיוצאים מהשדה, אם התוכן השתנה
    $$(".hl-input").forEach((ta) => {
      ta.addEventListener("input", () => {
        ta.previousElementSibling.innerHTML = backdropHtml(ta.value, post, links);
      });
      ta.addEventListener("blur", async () => {
        const { row, version, field } = ta.dataset;
        const r = findRow(row);
        if (ta.value === readValue(r, version, field)) return;
        writeValue(r, version, field, ta.value);
        await saveField(row, version, field, ta.value);
        refreshHighlights();
        say("השינוי נשמר.");
      });
    });

    // "נסה שוב" על שדה: פותח הערה וכפתור "כתוב מחדש"
    $$(".retry-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        const box = $(`#${btn.getAttribute("aria-controls")}`);
        box.hidden = !box.hidden;
        btn.setAttribute("aria-expanded", String(!box.hidden));
        if (!box.hidden) $("input", box).focus();
      }),
    );

    $$(".rewrite-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const { row, version, field } = btn.dataset;
        const box = btn.closest(".retry-box");
        const note = $("input", box);
        const err = $(".field-error", box);
        const ta = $(`#${box.id.replace(/-retry$/, "")}`);
        btn.disabled = true;
        btn.textContent = "כותבים מחדש...";
        err.textContent = "";
        try {
          const value = await retryField(row, version, field, note.value.trim());
          writeValue(findRow(row), version, field, value);
          ta.value = value;
          refreshHighlights();
          box.hidden = true;
          note.value = "";
          $(`[aria-controls="${box.id}"]`).setAttribute("aria-expanded", "false");
          ta.focus();
          say("השדה נכתב מחדש.");
        } catch (error) {
          err.textContent = `${error.message} השדה לא השתנה.`;
        } finally {
          btn.disabled = false;
          btn.textContent = "כתוב מחדש";
        }
      }),
    );

    // Enter בשדה ההערה מפעיל "כתוב מחדש"
    $$(".retry-box input").forEach((input) =>
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); $(".rewrite-btn", input.closest(".retry-box")).click(); }
      }),
    );

    $("#approve")?.addEventListener("click", async () => {
      await approvePost(number);
      setFlash([{ kind: "ok", html: "הפוסט אושר." }]);
      rerender();
    });

    $("#post-form").addEventListener("submit", (e) => e.preventDefault());
  }

  function onMount() {
    bindTabs();
    if (isOwner) bindOwner();
    else bindEditor();
  }

  return { title: `פוסט ${number}`, back: `#/cycle/${post.cycle}`, body, onMount };
}
