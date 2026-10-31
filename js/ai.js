// הקריאה למודל (ARCHITECTURE סעיף 4).
// בגרסה האמיתית: fetch ל-/api/generate עם ה-token של המשתמשת. באב הטיפוס: js/mock/ai.js.
// כשהקריאה נכשלת נזרקת שגיאה עם ההודעה בעברית שהפונקציה מחזירה.

import { USE_MOCK, FUNCTION_URL } from "./config.js";
import * as mock from "./mock/ai.js";

async function call(payload) {
  if (USE_MOCK) {
    return payload.mode === "post" ? mock.generatePost(payload) : mock.generateField(payload);
  }
  // הנחה: החיבור האמיתי ייכתב כשיהיו Supabase ו-Netlify. עד אז הקריאה נכשלת בהודעה ברורה
  if (!FUNCTION_URL) return { ok: false, error: { message: "הכתובת של המודל עוד לא הוגדרה." } };
  throw new Error("החיבור האמיתי עוד לא נבנה");
}

async function request(payload) {
  let response;
  try {
    response = await call(payload);
  } catch {
    throw new Error("לא הצלחנו להגיע למודל. נסי שוב.");
  }
  if (!response.ok) throw new Error(response.error?.message || "משהו השתבש. נסי שוב.");
  return response;
}

export async function generatePost(payload) {
  return (await request({ mode: "post", ...payload })).result;
}

export async function generateField(payload) {
  return (await request({ mode: "field", ...payload })).value;
}

// כלי לאב הטיפוס בלבד: "הדגמת שגיאה"
export const demoFailure = {
  get: () => USE_MOCK && mock.getFailMode(),
  set: (on) => mock.setFailMode(on),
};
