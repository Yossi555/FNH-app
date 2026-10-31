// מסד נתונים מדומה לאב הטיפוס: מחליף את Supabase.
// בטעינה הראשונה קורא את data/sample-data.json, ומאז שומר את כל השינויים ב-localStorage.
// "איפוס נתונים" מוחק את השמירה וחוזר לנתוני הדוגמה.
// כשעוברים ל-Supabase, מוחקים את התיקייה js/mock.

const STORAGE_KEY = "fnh-prototype-db";
const SAMPLE_URL = "data/sample-data.json";

// ברירות המחדל של הטבלאות, לפי ARCHITECTURE סעיף 2
const POST_DEFAULTS = {
  has_10: false, has_15: false, has_30: false, has_60: false,
  yt_long_seconds: null, images_ready: false,
  editing_done: false, editing_done_at: null,
  prompt: "", landing_page: null,
  status: null, approved_at: null,
  text_done: false, finished: false,
  created_at: null,
};

const TEXT_DEFAULTS = {
  versions: {},
  title: "", description: "", tags: "", pinned_comment: "", thumbnail_description_he: "",
  yossi_note: "", version_removed: false,
  retry_count: 0, manual_edit_count: 0,
  publish_at: null, published: false, final_file_url: null,
  updated_at: null,
};

let db = null;

function normalize(raw) {
  return {
    posts: raw.posts.map((p) => ({ ...POST_DEFAULTS, ...p })),
    texts: raw.texts.map((t) => ({ ...TEXT_DEFAULTS, id: crypto.randomUUID(), ...t })),
  };
}

function readSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

async function loadSample() {
  const res = await fetch(SAMPLE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("לא הצלחתי לקרוא את נתוני הדוגמה");
  return normalize(await res.json());
}

export async function loadDb() {
  if (db) return db;
  db = readSaved() || (await loadSample());
  saveDb();
  return db;
}

export function getDb() {
  if (!db) throw new Error("loadDb() לא נקרא");
  return db;
}

export function saveDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // אם localStorage חסום, הנתונים נשארים בזיכרון עד רענון
  }
}

export async function resetDb() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // גם ההתראות שכבר נראו מתאפסות, כדי שההדגמה תתחיל מההתחלה
    Object.keys(localStorage)
      .filter((k) => k.startsWith("fnh-seen-tasks-"))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* אין מה למחוק */ }
  db = null;
  return loadDb();
}
