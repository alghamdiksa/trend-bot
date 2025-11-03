// src/trends.js
// Node.js helpers: X (Twitter) via trends24, Instagram via best-hashtags
// لاحقاً سنضيف الاستدعاء من index.js وتحديث package.json

const axios = require("axios");
const cheerio = require("cheerio");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

// -------- X (Twitter) trends via trends24.in --------
const TRENDS24 = "https://trends24.in";
const COUNTRY_SLUG = {
  sa: "saudi-arabia",
  ae: "united-arab-emirates",
  eg: "egypt",
  kw: "kuwait",
  qa: "qatar",
  bh: "bahrain",
  om: "oman",
};

async function getXTrends(country = "sa", limit = 10) {
  const slug = COUNTRY_SLUG[(country || "").toLowerCase()] || "saudi-arabia";
  const url = `${TRENDS24}/${slug}/`;
  try {
    const { data } = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 15000 });
    const $ = cheerio.load(data);
    const trends = [];
    $(".trend-card .trend-card__list li a").each((_, a) => {
      const t = $(a).text().trim();
      if (!t || /^more/i.test(t)) return;
      trends.push(t);
    });
    const top = trends.slice(0, limit);
    if (!top.length) return [{ title: "لم أتمكن من جلب ترند X الآن.", link: "" }];
    return top.map(t => ({
      title: t,
      link: `https://x.com/search?q=${encodeURIComponent(t)}&src=trend_click`,
    }));
  } catch (e) {
    return [{ title: "تعذر الوصول إلى trends24 حالياً.", link: "" }];
  }
}

// -------- Instagram hashtags via best-hashtags.com --------
const BEST_HASHTAGS = "https://best-hashtags.com/hashtag/";
const IG_TOPIC = {
  sa: "saudiarabia",
  ae: "uae",
  eg: "egypt",
  kw: "kuwait",
  qa: "qatar",
  bh: "bahrain",
  om: "oman",
};

async function getInstagramHashtags(country = "sa", limit = 20) {
  const topic = IG_TOPIC[(country || "").toLowerCase()] || "saudiarabia";
  const url = `${BEST_HASHTAGS}${topic}/`;
  try {
    const { data } = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 15000 });
    const $ = cheerio.load(data);
    const block = $("#hashtags").text().trim();
    const tags = (block.match(/#\w+/g) || []).map(t => t.toLowerCase());
    const unique = Array.from(new Set(tags)).slice(0, limit);
    if (!unique.length) return ["#saudiarabia", "#ksa", "#الرياض", "#جدة", "#trending", "#instatrend"];
    return unique;
  } catch (e) {
    return ["#saudiarabia", "#ksa", "#trending"];
  }
}

module.exports = { getXTrends, getInstagramHashtags };
