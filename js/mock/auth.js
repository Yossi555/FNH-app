// כניסה מדומה: מחליפה את Supabase Auth באב הטיפוס.
// כל סיסמה שאינה ריקה מתקבלת. סיסמה ריקה מחזירה שגיאה, כדי שאפשר יהיה לראות את מצב השגיאה.
// הסשן נשמר ב-localStorage, כמו ש-supabase-js שומר אותו (ARCHITECTURE סעיף 3).

const SESSION_KEY = "fnh-prototype-session";

// התפקידים לפי ARCHITECTURE סעיף 3: owner = בעל העסק, user = המשתמשת
const USERS = {
  yossi: { id: "yossi", name: "יוסי", role: "owner" },
  sarit: { id: "sarit", name: "שרית", role: "user" },
};

export async function signIn(userId, password) {
  await new Promise((r) => setTimeout(r, 300)); // השהיה קצרה, כמו בקריאה לשרת
  const user = USERS[userId];
  if (!user || !password) {
    return { user: null, error: { message: "הסיסמה שגויה. נסו שוב." } };
  }
  try { localStorage.setItem(SESSION_KEY, user.id); } catch { /* בלי שמירה, הסשן יסתיים ברענון */ }
  return { user, error: null };
}

export async function signOut() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* אין מה למחוק */ }
}

export function getSessionUser() {
  try {
    return USERS[localStorage.getItem(SESSION_KEY)] || null;
  } catch {
    return null;
  }
}
