// החלפת [[LINK:id]] בכתובות, בהצגה ובהעתקה (ARCHITECTURE סעיף 4, "לינקים").
// הסימון נשמר בנתונים כמו שהוא. "landing" הוא דף הנחיתה שנבחר לפוסט.

import { esc } from "./ui.js";

const MARKER = /\[\[LINK:([a-z0-9_]+)\]\]/g;

let linksCache = null;

export async function loadLinks() {
  if (!linksCache) {
    const res = await fetch("data/links.json");
    if (!res.ok) throw new Error("לא הצלחתי לקרוא את רשימת הלינקים");
    linksCache = (await res.json()).links;
  }
  return linksCache;
}

// לינקים מסוג variable: האפשרויות של "דף נחיתה"
export function variableLinks(links) {
  return links.filter((l) => l.kind === "variable");
}

function urlFor(id, post, links) {
  const linkId = id === "landing" ? post.landing_page : id;
  return links.find((l) => l.id === linkId)?.url || null;
}

// טקסט להעתקה: כל סימון שיש לו כתובת מוחלף בה. סימון בלי כתובת נשאר כמו שהוא
export function resolveLinks(text, post, links) {
  return String(text ?? "").replace(MARKER, (marker, id) => urlFor(id, post, links) || marker);
}

// HTML להצגה: כמו resolveLinks, וסימון בלי כתובת מודגש (הנחה 5 ב-PRD).
// raw: הסימונים נשארים כמו שהם, רק ההדגשה נוספת (לשדה העריכה של שרית)
export function renderLinks(text, post, links, { raw = false } = {}) {
  const parts = [];
  let last = 0;
  const source = String(text ?? "");
  for (const match of source.matchAll(MARKER)) {
    parts.push(esc(source.slice(last, match.index)));
    const url = urlFor(match[1], post, links);
    if (!url) parts.push(`<mark class="link-missing">${esc(match[0])}</mark>`);
    else parts.push(raw ? esc(match[0]) : `<span class="link-ok">${esc(url)}</span>`);
    last = match.index + match[0].length;
  }
  parts.push(esc(source.slice(last)));
  return parts.join("");
}

export function hasMissingLink(text, post, links) {
  return [...String(text ?? "").matchAll(MARKER)].some((m) => !urlFor(m[1], post, links));
}
