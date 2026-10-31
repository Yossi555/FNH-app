// פונקציה טהורה: (פוסט, רשתות) ← הרשתות והגרסאות הרלוונטיות לפוסט.
// בלי גישה לנתונים ובלי DOM, כדי שאפשר יהיה להשתמש בה בכל מקום (ARCHITECTURE סעיף 5, אוטומציה 1).
//
// רשת וידאו רלוונטית אם לפחות אחד מהאורכים שלה סומן. "long" מסומן אם yt_long_seconds לא ריק.
// רשת תמונות רלוונטית אם images_ready מסומן.
// התוצאה: [{ network, versions: ["10", "15"] }], לפי הסדר של networks.json.

export function hasLength(post, length) {
  if (length === "long") return post.yt_long_seconds != null && post.yt_long_seconds > 0;
  return post[`has_${length}`] === true;
}

export function relevantNetworks(post, networks) {
  const result = [];
  for (const network of networks) {
    if (network.kind === "video") {
      const versions = network.lengths.filter((len) => hasLength(post, len));
      if (versions.length) result.push({ network, versions });
    } else if (post.images_ready) {
      // בפינטרסט img1 עד img4. ברשת עם תמונה אחת ובלי שדות לפי גרסה, versions ריק
      const versions = network.version_fields.length
        ? Array.from({ length: network.images }, (_, i) => `img${i + 1}`)
        : [];
      result.push({ network, versions });
    }
  }
  return result;
}
