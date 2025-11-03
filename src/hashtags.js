// src/hashtags.js — استخراج هاشتاقات جاهزة للعرض من مصادر X وGoogle بدون تغيير دوالك الأصلية
import axios from "axios";
import { buildXTrendCards, scrapeDailyTrends } from "./trends.js";

const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY;

/**
 * X: نعتمد دالتك buildXTrendCards ونستخرج الهاشتاقات من نص الكرت.
 * يرجع: [{ tag: "#Something", url: "https://twitter.com/hashtag/Something?src=trend_click" }, ...]
 */
export async function getXHashtags(countryCode, limit = 10) {
  try {
    const cards = await buildXTrendCards(countryCode, Math.max(limit * 2, 20)); // نجيب أكثر ثم نفلتر
    const seen = new Set();
    const items = [];

    for (const c of cards || []) {
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
  } catch {
    return [];
  }
}

/**
 * Google: نحاول SearchAPI.io أولاً (إن وجد المفتاح)، ثم Fallback عبر scrapeDailyTrends.
 * يرجع: [{ tag: "#Keyword_X", url: "https://www.google.com/search?q=..." }, ...]
 */
export async function getGoogleHashtags(geoCode, limit = 10, { axiosInstance } = {}) {
  const ax = axiosInstance || axios;
  // API أولاً
  if (SEARCHAPI_KEY) {
    try {
      const { data } = await ax.get("https://www.searchapi.io/api/v1/search", {
        params: {
          engine: "google_trends_trending_now",
          geo: geoCode,
          time: "past_24_hours",
          hl: "ar",
          api_key: SEARCHAPI_KEY
        }
      });
      const trends = Array.isArray(data?.trends) ? data.trends.slice(0, Math.max(limit * 2, 20)) : [];
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
    } catch {
      // نكمل للـ Fallback
    }
  }

  // Fallback مجاني
  try {
    const fallback = await scrapeDailyTrends(geoCode, Math.max(limit * 2, 20));
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
