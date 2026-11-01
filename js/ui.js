// רכיבים משותפים: אייקונים, הגנה על טקסט, וקיצורי DOM.
// גם: חלון, הודעה אחרי פעולה וכפתור העתקה.

// מגן על טקסט שמוכנס ל-HTML
export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// אייקונים קוויים, בעובי אחיד, בצבע הטקסט (currentColor)
const PATHS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5"/><path d="M12 18h.01"/>',
  // חץ "חזרה": ב-RTL הוא מצביע ימינה
  back: '<path d="M9 5l7 7-7 7"/>',
  // חץ "קדימה" / כניסה לשורה: ב-RTL הוא מצביע שמאלה
  forward: '<path d="M15 5l-7 7 7 7"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  retry: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
};

export function icon(name, cls = "icon") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`;
}

// ===== תגיות סטטוס =====
// הסטטוסים לפי DESIGN.md: ריק, טיוטה, מאושר, גמור

export const STATUS_LABELS = { empty: "ריק", draft: "טיוטה", approved: "מאושר", finished: "גמור" };

export function badge(status, count) {
  const text = count === undefined ? STATUS_LABELS[status] : `${STATUS_LABELS[status]} ${count}`;
  return `<span class="badge badge-${status}">${text}</span>`;
}

// ===== אווטאר =====
// לפי "אווטאר" ב-DESIGN, חלק 2. עד שהתמונות יחוברו (שלב 2), עיגול עם האות הראשונה.

export const PEOPLE = { owner: "יוסי", user: "שרית" };

export function avatar(role, size = 32) {
  return `<span class="avatar avatar-${role}" style="--size: ${size}px" aria-hidden="true">${esc(PEOPLE[role][0])}</span>`;
}

// ===== תאריכים =====

// "14.10", כמו ב-mockups
export function shortDate(date) {
  const d = new Date(date);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ===== חלון =====
// חלון במרכז המסך, מעל שכבה כהה. נסגר ב-X, ב-Esc, בלחיצה על הרקע או ב"ביטול".
// onSubmit מקבל את הטופס. אם הוא מחזיר false, החלון נשאר פתוח (למשל כשיש שגיאה).

export function openModal({ title, body, primary, primaryClass = "btn-primary", secondary = "ביטול", onSubmit }) {
  const opener = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <form class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" novalidate>
      <div class="modal-head">
        <h2 class="h3" id="modal-title">${esc(title)}</h2>
        <button type="button" class="icon-btn modal-x" aria-label="סגירה">${icon("close")}</button>
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-actions">
        <button type="submit" class="btn ${primaryClass}">${esc(primary)}</button>
        <button type="button" class="btn btn-secondary modal-cancel">${esc(secondary)}</button>
      </div>
    </form>`;
  document.body.append(overlay);
  const form = $("form", overlay);

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    opener?.focus?.();
  }

  function onKey(e) {
    if (e.key === "Escape") return close();
    if (e.key !== "Tab") return;
    // המיקוד נשאר בתוך החלון
    const items = $$("button, input, select, textarea, a[href]", form).filter((el) => !el.disabled);
    const first = items[0];
    const last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  document.addEventListener("keydown", onKey);
  $(".modal-x", form).addEventListener("click", close);
  $(".modal-cancel", form).addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const keepOpen = (await onSubmit?.(form)) === false;
    if (!keepOpen) close();
  });

  ($("input, select, textarea", form) || $('[type="submit"]', form)).focus();
  return { form, close };
}

// ===== הודעה אחרי פעולה =====
// הודעה שמוצגת פעם אחת, במסך שמצויר מחדש אחרי הפעולה.
// kind: "ok" (ירוק) או "err" (בצבע ההתראה). html כבר מוגן.

let flash = null;

export function setFlash(messages) {
  flash = messages;
}

export function renderFlash() {
  if (!flash) return "";
  const html = flash.map((m) => `
    <div class="banner banner-${m.kind}" role="status">${icon(m.kind === "err" ? "alert" : "check")}<div>${m.html}</div></div>`).join("");
  flash = null;
  return html;
}

// ===== העתקה =====

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // גיבוי לדפדפן בלי הרשאה ל-clipboard
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

// כפתור העתקה מרובע. אחרי ההעתקה מוצג ✓ לרגע
export function copyButton(label, attrs = "") {
  return `<button type="button" class="icon-btn copy-btn" aria-label="העתקה: ${esc(label)}" ${attrs}>${icon("copy")}</button>`;
}

export async function handleCopy(btn, text, statusEl) {
  const ok = await copyText(text);
  if (statusEl) statusEl.textContent = ok ? "הטקסט הועתק." : "ההעתקה נכשלה.";
  if (!ok) return;
  btn.classList.add("is-ok");
  btn.innerHTML = icon("check");
  setTimeout(() => {
    btn.classList.remove("is-ok");
    btn.innerHTML = icon("copy");
  }, 1500);
}

// מצייר מחדש את המסך הנוכחי, אחרי שינוי בנתונים
export function rerender() {
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}
