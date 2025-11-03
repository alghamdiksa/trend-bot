// src/trends.js — السعودية فقط — X عبر trends24 + Instagram — بدون Google نهائيًا
import axios from "axios";

const sleep = (ms) => new Promise(res => setTimeout(res, ms));
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ar,en-US;q=0.8,en;q=0.7"
};

// فقط الدول التي تهمنا (مع خرائط slug لموقع trends24)
const TRENDS24_SLUG = { sa: "saudi-arabia" };

// ========== X via trends24 ==========
async function fetchTrends24(countryCode, limit) {
  const slug = TRENDS24_SLUG[countryCode] || countryCode;
  const url = `https://trends24.in/${slug}/`;
  const { data: html } = await axios.get(url, { timeout: 15000, headers: DEFAULT_HEADERS });
  const anchorRegex = /<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gim;
  const items = [];
  const seen = new Set();
  let m;
  while ((m = anchorRegex.exec(html)) !== null) {
    let label = stripTags(m[2]).trim();
    if (!label) continue;
    if (/Tag Cloud|Table|Timeline/i.test(label)) continue;
    const text = label.startsWith("#") ? label : `#${label.replace(/\s+/g, "")}`;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const link = `https://twitter.com/search?q=${encodeURIComponent(text)}&src=trend_click`;
    items.push({ text, link });
    if (items.length >= limit) break;
  }
  return items;
}

export async function buildXTrendCards(countryCode, limit = 10) {
  try {
    const list = await fetchTrends24(countryCode, limit);
    return list.map(({ text, link }) => ({
      text,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔎 بحث X", url: link }, { text: "📋 نسخ", callback_data: `copy_${text}` }]
        ]
      }
    }));
  } catch (err) {
    console.error("Error fetching X trends:", err?.message || err);
    return [];
  }
}

// ========== Instagram ==========
export async function buildInstagramCards(countryCode, limit = 10) {
  // قائمة سعودية بسيطة
  const hashtags = ["جدة", "الرياض", "ترند", "حفلات", "اكتشاف", "تصوير", "الان", "موسم", "مقاطع", "مؤثرين"];

  const out = hashtags.slice(0, limit).map(tag => {
    const q = `#${tag}`;
    return {
      text: `📸 ${q}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔎 بحث IG", url: `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/` },
            { text: "📋 نسخ", callback_data: `copy_${q}` }
          ]
        ]
      }
    };
  });

  await sleep(250);
  return out;
}

// ====== Helpers ======
function stripTags(html) { return html.replace(/<[^>]*>/g, ""); }

// تأكيد التصدير بالاسم — لا يوجد Google هنا
export { buildXTrendCards, buildInstagramCards };
