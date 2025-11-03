// src/hashtags.js — استخراج هاشتاقات X فقط (السعودية) بالاعتماد على trends.js
import * as Trends from "./trends.js";

// X: نستخرج الهاشتاقات من نص الكروت
export async function getXHashtags(countryCode, limit = 10) {
  try {
    const cards = await Trends.buildXTrendCards(countryCode, Math.max(limit * 2, 20));
    const seen = new Set();
    const items = [];
    for (const c of cards || []) {
      const text = (c?.text || "").toString();
      const matches = text.match(/#[\p{L}\p{N}_]+/gu) || [];
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
  } catch { return []; }
}
