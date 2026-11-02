// הגדרות האפליקציה. בגרסה האמיתית ימולאו כאן הכתובת והמפתח הציבורי של Supabase,
// וכתובת הפונקציה ב-Netlify. באב הטיפוס הם ריקים, ו-USE_MOCK מפעיל את הנתונים המדומים.

export const USE_MOCK = true;

export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";
export const FUNCTION_URL = "";

// המספר הבא אחרי הפוסט האחרון שקיים ביום המעבר. משמש רק כשהטבלה ריקה.
// הנחה: 0057, כמו הפוסט הראשון בנתוני הדוגמה. יוסי יעדכן לפני המעבר.
export const START_POST_NUMBER = "0057";

// שם ואווטאר לכל תפקיד (ARCHITECTURE סעיף 7). בלי מיילים, כי הריפו ציבורי.
// האווטארים הם עותקים של 160 פיקסל מתוך yossi.png ו-sarit.png: חדים ברטינה עד 80 פיקסל, וקלים לטעינה.
export const USERS = {
  owner: { name: "יוסי", avatar: "assets/avatars/yossi-160.webp" },
  user: { name: "שרית", avatar: "assets/avatars/sarit-160.webp" },
};

// ימים עד תאריך היעד של "כתיבת מלל" (PRD, החלטה 6)
export const DUE_DAYS = 3;
