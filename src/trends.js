// === أضِف في نهاية src/trends.js ===

// تبني هاشتاقات X بالاعتماد على كروتك الحالية
export async function getXHashtags(cc, limit = 10) {
  // لديك مسبقاً buildXTrendCards() في هذا الملف
  const cards = await buildXTrendCards(cc, limit * 2); // نجيب أكثر ونفلتر
  const seen = new Set();
  const items = [];

  for (const c of cards || []) {
    // نحاول استخراج الهاشتاقات من نص الكرت
    const text = (c?.text || "").toString();
    const matches = text.match(/#[\p{L}\p{N}_]+/gu) || []; // يدعم العربية واللاتينية
    for (const m of matches) {
      const tag = m.trim();
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        tag,
        url: `https://twitter.com/hashtag/${encodeURIComponent(tag.replace(/^#/, ""))}?src=trend_click`
      });
      if (items.length >= limit) break;
    }
    if (items.length >= limit) break;
  }
  return items;
}

// Google: نفس منطقك (SearchAPI + Fallback) لكن نخرجه كهاشتاقات
export async function getGoogleHashtags(geoCode, limit = 10, opts = {}) {
  const { axiosInstance } = opts;
  const ax = axiosInstance || (await import("axios")).default;
  const apiKey = process.env.SEARCHAPI_KEY;

  // نحاول الـ API أولاً
  try {
    const { data } = await ax.get("https://www.searchapi.io/api/v1/search", {
      params: {
        engine: "google_trends_trending_now",
        geo: geoCode,
        time: "past_24_hours",
        hl: "ar",
        api_key: apiKey
      }
    });
    const trends = Array.isArray(data?.trends) ? data.trends.slice(0, limit * 2) : [];
    const out = [];
    const seen = new Set();
    for (const t of trends) {
      const q = (t?.query || "").toString().trim();
      if (!q) continue;
      const tag = "#" + q.replace(/[#]+/g, "").replace(/\s+/g, "_");
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ tag, url: `https://www.google.com/search?q=${encodeURIComponent(q)}` });
      if (out.length >= limit) break;
    }
    if (out.length) return out;
  } catch {}

  // Fallback مجاني لديك مسبقاً
  try {
    const fallback = await scrapeDailyTrends(geoCode, limit * 2);
    const out = [];
    const seen = new Set();
    for (const t of fallback || []) {
      const title = (t?.title || "").toString().trim();
      if (!title) continue;
      const tag = "#" + title.replace(/[#]+/g, "").replace(/\s+/g, "_");
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ tag, url: t?.url || `https://www.google.com/search?q=${encodeURIComponent(title)}` });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
