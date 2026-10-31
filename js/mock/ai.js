// מודל AI מדומה: מחליף את /api/generate באב הטיפוס.
// מחזיר טקסט קבוע אחרי השהיה קצרה, באותו מבנה שהפונקציה האמיתית מחזירה (ARCHITECTURE סעיף 4).
// "הדגמת שגיאה" גורמת לקריאה הבאה להיכשל, כדי שאפשר יהיה לראות את מצב השגיאה.

const DELAY_POST = 2000;
const DELAY_FIELD = 1200;

let failMode = false;

export function setFailMode(on) {
  failMode = on;
}

export function getFailMode() {
  return failMode;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ERROR = { ok: false, error: { code: "ai_timeout", message: "המודל לא ענה בזמן. נסי שוב." } };

// "Jar-Pome" ← "Jar Pome"
function niceName(videoName) {
  return videoName.replace(/[-_]+/g, " ");
}

function linkLines(linkIds) {
  return linkIds.map((id) => (id === "landing" ? `Learn the full technique: [[LINK:landing]]` : `More: [[LINK:${id}]]`));
}

// טקסט קבוע לכל שדה. variant 1 הוא הנוסח של "נסה שוב"
function fieldText(field, { name, version, linkIds, ytSeconds }, variant = 0) {
  const secs = version === "long" ? ytSeconds || "long" : version;
  const texts = {
    on_screen_text: [`${name}, poured by hand`, `Slow pour, warm glow: ${name}`],
    voiceover: version === "long"
      ? [`In this ${secs}-second video we make ${name} from start to first light, step by step.`,
         `Let's slow down and pour ${name} together, from melting the wax to the very first flame.`]
      : [`A ${secs}-second look at ${name}. Simple, warm, and made at home.`,
         `${name} in ${secs} seconds: melt, pour, and let it glow.`],
    on_image_text: [`${name} · ${version}`, `Made by hand · ${version}`],
    title: [`${name} – Handmade Candle`, `How I Made ${name} at Home`],
    description: [
      [`Poured by hand, one candle at a time.`, ...linkLines(linkIds)].join("\n"),
      [`A cozy little project for a slow weekend.`, ...linkLines(linkIds)].join("\n"),
    ],
    tags: ["handmade candle, diy candle, cozy home", "candle making, home decor, slow living"],
    pinned_comment: ["Which scent should I pour next?", "Would you light this one in the kitchen or the bedroom?"],
    thumbnail_description_he: ["נר בעבודת יד על שולחן עץ, באור חם", "תקריב של הנר הדולק, ברקע חלון ואור ערב"],
  };
  return texts[field][variant];
}

// מצב post: כתיבת פוסט שלם
export async function generatePost(payload) {
  await wait(DELAY_POST);
  if (failMode) return ERROR;
  const name = niceName(payload.video_name);
  const result = {};
  for (const target of payload.targets) {
    const ctx = { name, linkIds: target.link_ids, ytSeconds: payload.yt_long_seconds };
    const out = { versions: {} };
    for (const version of target.versions) {
      out.versions[version] = Object.fromEntries(
        target.version_fields.map((f) => [f, fieldText(f, { ...ctx, version })]));
    }
    for (const field of target.fields) out[field] = fieldText(field, ctx);
    result[target.network] = out;
  }
  return { ok: true, result };
}

// מצב field: "נסה שוב" על שדה בודד
export async function generateField(payload) {
  await wait(DELAY_FIELD);
  if (failMode) return ERROR;
  const ctx = {
    name: niceName(payload.video_name), version: payload.version,
    linkIds: payload.link_ids, ytSeconds: payload.yt_long_seconds,
  };
  return { ok: true, value: fieldText(payload.field, ctx, 1) };
}
