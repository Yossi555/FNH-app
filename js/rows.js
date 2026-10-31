// יצירת שורות ב-texts אחרי "סיימתי" של יוסי (ARCHITECTURE סעיף 5, אוטומציה 1).
// משתמש ב-shared/relevance.js. שורה קיימת לא משתנה, כמו upsert עם ignoreDuplicates.

import { getDb, saveDb } from "./mock/store.js";
import { relevantNetworks } from "../shared/relevance.js";

let networksCache = null;

export async function loadNetworks() {
  if (!networksCache) {
    const res = await fetch("data/networks.json");
    if (!res.ok) throw new Error("לא הצלחתי לקרוא את רשימת הרשתות");
    networksCache = (await res.json()).networks;
  }
  return networksCache;
}

// למשל 0059_Jar-Pome_FB
export function outputId(post, network) {
  return `${post.post_number}_${post.video_name}_${network.code}`;
}

// מחזיר { created: מספר השורות החדשות, noRows: פוסטים שלא נוצרה להם אף שורה }
export async function createRows(postNumbers) {
  const networks = await loadNetworks();
  const db = getDb();
  const now = new Date().toISOString();
  let created = 0;
  const noRows = [];

  for (const number of postNumbers) {
    const post = db.posts.find((p) => p.post_number === number);
    const relevant = relevantNetworks(post, networks);
    if (!relevant.length) {
      // הנחה 3 ב-PRD: פוסט בלי אורכים ובלי "תמונות מוכנות"
      if (!db.texts.some((t) => t.post_number === number)) noRows.push(post);
      continue;
    }
    for (const { network, versions } of relevant) {
      const exists = db.texts.some((t) => t.post_number === number && t.network === network.id);
      if (exists) continue;
      db.texts.push({
        id: crypto.randomUUID(),
        post_number: number,
        network: network.id,
        output_id: outputId(post, network),
        versions: Object.fromEntries(versions.map((v) => [v, {}])),
        title: "", description: "", tags: "", pinned_comment: "", thumbnail_description_he: "",
        yossi_note: "", version_removed: false,
        retry_count: 0, manual_edit_count: 0,
        publish_at: null, published: false, final_file_url: null,
        updated_at: now,
      });
      created++;
    }
  }
  saveDb();
  return { created, noRows };
}

// אחרי שינוי של שם הווידאו: output_id נבנה מחדש לכל השורות של הפוסט
export async function renameRows(post) {
  const networks = await loadNetworks();
  const db = getDb();
  for (const row of db.texts.filter((t) => t.post_number === post.post_number)) {
    const network = networks.find((n) => n.id === row.network);
    row.output_id = outputId(post, network);
    row.updated_at = new Date().toISOString();
  }
  saveDb();
}
