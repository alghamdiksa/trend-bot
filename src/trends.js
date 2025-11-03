// src/trends.js — الملف الأصلي لاسترجاع وظائف البوت الأساسية بدون اختصار

import axios from "axios";

// ========== مساعدات ==========
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// ========== مصادر X ==========
export async function buildXTrendCards(countryCode, limit = 10) {
  try {
    const url = `https://trends24.in/${countryCode}/`;
    const { data: html } = await axios.get(url, { timeout: 10000 });

    const regex = /<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    const items = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      const raw = match[2].trim();
      if (!raw) continue;

      const text = raw.startsWith("#") ? raw : `#${raw.replace(/\s+/g, "")}`;
      const link = `https://twitter.com/search?q=${encodeURIComponent(text)}`;

      items.push({
        text,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔎 بحث X", url: link },
              { text: "📋 نسخ", callback_data: `copy_${text}` }
            ]
          ]
        }
      });

      if (items.length >= limit) break;
    }
    return items;
  } catch (err) {
    console.error("Error fetching X trends:", err.message);
    return [];
  }
}

// ========== مصادر إنستقرام ==========
export async function buildInstagramCards(countryCode, limit = 10) {
  const hashtags = {
    sa: ["جدة", "الرياض", "الترند", "موضة", "حفلات"],
    eg: ["القاهرة", "ترند", "الأهلي", "فن", "مصر"],
    ae: ["دبي", "ابوظبي", "مال", "اكسبلور", "ترند"],
    us: ["usa", "news", "hollywood", "fashion", "trending"],
    gb: ["london", "uk", "football", "news", "trending"],
    in: ["india", "bollywood", "cricket", "trend", "reels"]
  }[countryCode] || ["trend", "viral"];

  const out = hashtags.slice(0, limit).map(tag => {
    const query = `#${tag}`;
    return {
      text: `📸 ${query}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔎 بحث IG", url: `https://www.instagram.com/explore/tags/${tag}/` },
            { text: "📋 نسخ", callback_data: `copy_${query}` }
          ]
        ]
      }
    };
  });

  await delay(300);
  return out;
}

// ========== Google Trends (Fallback HTML scraper) ==========
export async function scrapeDailyTrends(geo, limit = 10) {
  try {
    const url = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`;
    const { data: xml } = await axios.get(url, { timeout: 10000 });

    const items = [];
    const entryRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>/g;
    let match;
    while ((match = entryRegex.exec(xml)) !== null) {
      const title = match[1]?.trim();
      const link = match[2]?.trim();
      if (title) items.push({ title, url: link });
      if (items.length >= limit) break;
    }
    return items;
  } catch (err) {
    console.error("Google fallback error:", err.message);
    return [];
  }
}
