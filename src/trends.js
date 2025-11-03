// src/trends.js — جلب ترند X وInstagram وGoogle Fallback مع إصلاح مسارات trends24 ورابط RSS
import axios from "axios";

// ========== أدوات عامة ==========
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// بعض المواقع تصدّ الطلبات بلا User-Agent صريح
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ar,en-US;q=0.8,en;q=0.7"
};

// ========== خريطة الدولة -> slug لموقع trends24 ==========
const TRENDS24_SLUG = {
  sa: "saudi-arabia",
  eg: "egypt",
  ae: "united-arab-emirates",
  us: "united-states",
  gb: "united-kingdom",
  in: "india"
};

// ========== X (Twitter) via trends24 ==========
/**
 * يبني كروت ترند X من trends24.
 * @param {string} countryCode - رموزنا المختصرة: sa, eg, ae, us, gb, in
 * @param {number} limit - عدد العناصر المطلوب
 * @returns {Promise<Array<{text: string, reply_markup: object}>>}
 */
export async function buildXTrendCards(countryCode, limit = 10) {
  try {
    const slug = TRENDS24_SLUG[countryCode] || countryCode; // fallback لو أعطيت slug جاهز
    const url = `https://trends24.in/${slug}/`;

    const { data: html } = await axios.get(url, {
      timeout: 15000,
      headers: DEFAULT_HEADERS
    });

    // trends24 يكرر القوائم بعدة ساعات، نلتقط أول عمود "just now" وأيضًا نضمن استخراج شامل
    // الروابط داخل العناصر تكون مثل: <a href="/hashtags/..." ...>#هاشتاق</a> أو نص ترند
    const anchorRegex = /<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gim;
    const items = [];
    const seen = new Set();
    let m;
    while ((m = anchorRegex.exec(html)) !== null) {
      let label = stripTags(m[2]).trim();
      if (!label) continue;

      // تجاهل روابط التنقل داخل الموقع (مثل Tag Cloud, Table)
      if (/Tag Cloud|Table|Timeline/i.test(label)) continue;

      // بعض العناصر بدون #. نحوّلها إلى هاشتاق مقروء
      const text = label.startsWith("#")
        ? label
        : `#${label.replace(/\s+/g, "")}`;

      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const link = `https://twitter.com/search?q=${encodeURIComponent(text)}&src=trend_click`;
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
    console.error("Error fetching X trends:", err?.message || err);
    return [];
  }
}

// ========== Instagram (تجميعة بسيطة بالهاشتاقات) ==========
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

// ========== Google Trends Fallback (RSS) ==========
/**
 * يجلب ترند Google اليومي عبر RSS. يجرّب عدة صيغ إذا ظهرت 404.
 * @param {string} geo - مثال: SA, EG, AE...
 * @param {number} limit
 * @returns {Promise<Array<{title: string, url: string}>>}
 */
export async function scrapeDailyTrends(geo, limit = 10) {
  const urls = [
    // الصيغة القياسية
    `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${encodeURIComponent(geo)}`,
    // نضيف لغة عربية
    `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${encodeURIComponent(geo)}&hl=ar`,
    // وأخرى بالإنجليزية
    `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${encodeURIComponent(geo)}&hl=en`
  ];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const { data: xml } = await axios.get(url, {
        timeout: 15000,
        headers: {
          ...DEFAULT_HEADERS,
          Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8"
        },
        validateStatus: s => s >= 200 && s < 500 // نخلي 404 تمر عشان نجرب التالية
      });

      // لو 404 نكمل على الرابط التالي
      if (typeof xml === "string" && xml.startsWith("<")) {
        const items = [];
        const entryRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>/g;
        let match;
        while ((match = entryRegex.exec(xml)) !== null) {
          const title = decodeHtml(match[1]).trim();
          const link = decodeHtml(match[2]).trim();
          if (title) items.push({ title, url: link || `https://www.google.com/search?q=${encodeURIComponent(title)}` });
          if (items.length >= limit) break;
        }
        if (items.length) return items;
      }
    } catch (err) {
      // نجرب الرابط التالي
      console.error("Google fallback try failed:", err?.message || err);
    }
  }

  console.error("Google fallback error: no feed found for geo:", geo);
  return [];
}

// ========== أدوات مساعدة للنص ==========
function stripTags(html) {
  return html.replace(/<[^>]*>/g, "");
}

function decodeHtml(s = "") {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
