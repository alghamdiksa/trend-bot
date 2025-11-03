// ========== Google Trends Fallback (JSON أولاً ثم RSS) ==========
/**
 * يجلب ترند Google اليومي. يجرب:
 * 1) JSON: /trends/api/dailytrends
 * 2) JSON: /trends/api/realtimetrends (إن لزم)
 * 3) RSS:  /trends/trendingsearches/daily/rss
 *
 * يرجع: [{ title, url }]
 */
export async function scrapeDailyTrends(geo, limit = 10) {
  const headers = {
    ...DEFAULT_HEADERS,
    Accept: "application/json,text/plain,*/*"
  };

  // 1) dailytrends JSON (أفضل خيار)
  const jsonDailyUrls = [
    `https://trends.google.com/trends/api/dailytrends?hl=ar&tz=180&geo=${encodeURIComponent(geo)}&ns=15`,
    `https://trends.google.com/trends/api/dailytrends?hl=en&tz=180&geo=${encodeURIComponent(geo)}&ns=15`
  ];

  for (const url of jsonDailyUrls) {
    try {
      const { data, status } = await axios.get(url, {
        timeout: 15000,
        headers,
        validateStatus: s => s >= 200 && s < 500
      });
      if (status === 200 && typeof data === "string") {
        // JSON من Google يأتي مع بادئة XSSI: )]}'
        const cleaned = data.replace(/^\)\]\}',?/, "").trim();
        const obj = JSON.parse(cleaned);
        const searches = obj?.default?.trendingSearchesDays?.[0]?.trendingSearches || [];
        const out = [];
        for (const it of searches) {
          const title = it?.title?.query || "";
          if (!title) continue;
          const firstArticle = it?.articles?.[0]?.url || "";
          out.push({
            title,
            url: firstArticle || `https://www.google.com/search?q=${encodeURIComponent(title)}`
          });
          if (out.length >= limit) break;
        }
        if (out.length) return out;
      }
    } catch {
      /* جرّب التالي */
    }
  }

  // 2) realtimetrends JSON كخيار إضافي
  const jsonRealtimeUrls = [
    `https://trends.google.com/trends/api/realtimetrends?hl=ar&tz=180&cat=all&fi=0&fs=0&geo=${encodeURIComponent(geo)}&ri=300&rs=20&sort=0`,
    `https://trends.google.com/trends/api/realtimetrends?hl=en&tz=180&cat=all&fi=0&fs=0&geo=${encodeURIComponent(geo)}&ri=300&rs=20&sort=0`
  ];

  for (const url of jsonRealtimeUrls) {
    try {
      const { data, status } = await axios.get(url, {
        timeout: 15000,
        headers,
        validateStatus: s => s >= 200 && s < 500
      });
      if (status === 200 && typeof data === "string") {
        const cleaned = data.replace(/^\)\]\}',?/, "").trim();
        const obj = JSON.parse(cleaned);
        const stories = obj?.storySummaries?.trendingStories || [];
        const out = [];
        for (const st of stories) {
          const title = st?.title || st?.entityNames?.[0] || "";
          if (!title) continue;
          const firstArticle = st?.articles?.[0]?.url || "";
          out.push({
            title,
            url: firstArticle || `https://www.google.com/search?q=${encodeURIComponent(title)}`
          });
          if (out.length >= limit) break;
        }
        if (out.length) return out;
      }
    } catch {
      /* جرّب التالي */
    }
  }

  // 3) RSS كآخر حل
  const rssUrls = [
    `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${encodeURIComponent(geo)}`,
    `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${encodeURIComponent(geo)}&hl=ar`,
    `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${encodeURIComponent(geo)}&hl=en`
  ];

  for (const url of rssUrls) {
    try {
      const { data: xml, status } = await axios.get(url, {
        timeout: 15000,
        headers: {
          ...DEFAULT_HEADERS,
          Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8"
        },
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
    } catch {
      /* جرّب التالي */
    }
  }

  console.error("Google fallback error: no feed found for geo:", geo);
  return [];
}
// --- exports guard (لا تلمسه بعد الإضافة) ---
export { buildXTrendCards, buildInstagramCards, scrapeDailyTrends };
