// src/trends.js — جلب ترند X وInstagram وGoogle Fallback (JSON أولاً) + تصدير مُسمّى مؤكد
import axios from "axios";

const sleep = (ms) => new Promise(res => setTimeout(res, ms));
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ar,en-US;q=0.8,en;q=0.7"
};

const TRENDS24_SLUG = {
  sa: "saudi-arabia",
  eg: "egypt",
  ae: "united-arab-emirates",
  us: "united-states",
  gb: "united-kingdom",
  in: "india"
};

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
  const hashtags = {
    sa: ["جدة", "الرياض", "ترند", "حفلات", "اكتشاف"],
    eg: ["القاهرة", "ترند", "الأهلي", "فن", "مصر"],
    ae: ["دبي", "ابوظبي", "ترند", "ريادة", "تصوير"],
    us: ["usa", "news", "hollywood", "fashion", "trending"],
    gb: ["london", "uk", "football", "news", "trending"],
    in: ["india", "bollywood", "cricket", "trend", "reels"]
  }[countryCode] || ["trend", "viral", "explore"];

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

// ========== Google Trends (JSON أولاً، ثم RSS) ==========
export async function scrapeDailyTrends(geo, limit = 10) {
  const headers = { ...DEFAULT_HEADERS, Accept: "application/json,text/plain,*/*" };

  // 1) JSON dailytrends
  const jsonDailyUrls = [
    `https://trends.google.com/trends/api/dailytrends?hl=ar&tz=180&geo=${encodeURIComponent(geo)}&ns=15`,
    `https://trends.google.com/trends/api/dailytrends?hl=en&tz=180&geo=${encodeURIComponent(geo)}&ns=15`
  ];
  for (const url of jsonDailyUrls) {
    try {
      const { data, status } = await axios.get(url, { timeout: 15000, headers, validateStatus: s => s >= 200 && s < 500 });
      if (status === 200 && typeof data === "string") {
        const cleaned = data.replace(/^\)\]\}',?/, "").trim();
        const obj = JSON.parse(cleaned);
        const searches = obj?.default?.trendingSearchesDays?.[0]?.trendingSearches || [];
        const out = [];
        for (const it of searches) {
          const title = it?.title?.query || "";
          if (!title) continue;
          const firstArticle = it?.articles?.[0]?.url || "";
          out.push({ title, url: firstArticle || `https://www.google.com/search?q=${encodeURIComponent(title)}` });
          if (out.length >= limit) break;
        }
        if (out.length) return out;
      }
    } catch {}
  }

  // 2) JSON realtimetrends
  const jsonRealtimeUrls = [
    `https://trends.google.com/trends/api/realtimetrends?hl=ar&tz=180&cat=all&fi=0&fs=0&geo=${encodeURIComponent(geo)}&ri=300&rs=20&sort=0`,
    `https://trends.google.com/trends/api/realtimetrends?hl=en&tz=180&cat=all&fi=0&fs=0&geo=${encodeURIComponent(geo)}&ri=300&rs=20&sort=0`
  ];
  for (const url of jsonRealtimeUrls) {
    try {
      const { data, status } = await axios.get(url, { timeout: 15000, headers, validateStatus: s => s >= 200 && s < 500 });
      if (status === 200 && typeof data === "string") {
        const cleaned = data.replace(/^\)\]\}',?/, "").trim();
        const obj = JSON.parse(cleaned);
        const stories = obj?.storySummaries?.trendingStories || [];
        const out = [];
        for (const st of stories) {
          const title = st?.title || st?.entityNames?.[0] || "";
          if (!title) continue;
          const firstArticle = st?.articles?.[0]?.url || "";
          out.push({ title, url: firstArticle || `https://www.google.com/search?q=${encodeURIComponent(title)}` });
          if (out.length >= limit) break;
        }
        if (out.length) return out;
      }
    } catch {}
  }

  // 3) RSS
  const rssUrls = [
    `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${encodeURIComponent(geo)}`,
    `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${encodeURIComponent(geo)}&hl=ar`,
    `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${encodeURIComponent(geo)}&hl=en`
  ];
  for (const url of rssUrls) {
    try {
      const { data: xml, status } = await axios.get(url, {
        timeout: 15000,
        headers: { ...DEFAULT_HEADERS, Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8" },
        validateStatus: s => s >= 200 && s < 500
      });
      if (status === 200 && typeof xml === "string" && xml.startsWith("<")) {
        const items = [];
        const entryRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>/g;
        let m;
        while ((m = entryRegex.exec(xml)) !== null) {
          const title = decodeHtml(m[1]).trim();
          const link = decodeHtml(m[2]).trim();
          if (title) items.push({ title, url: link || `https://www.google.com/search?q=${encodeURIComponent(title)}` });
          if (items.length >= limit) break;
        }
        if (items.length) return items;
      }
    } catch {}
  }

  console.error("Google fallback error: no feed found for geo:", geo);
  return [];
}

// ====== Helpers ======
function stripTags(html) { return html.replace(/<[^>]*>/g, ""); }
function decodeHtml(s = "") {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
}

// تأكيد التصدير بالاسم
export { buildXTrendCards, buildInstagramCards, scrapeDailyTrends };
