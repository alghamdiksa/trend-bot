import axios from "axios";
import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

// ------------------ X (Twitter) via trends24 ------------------
const TRENDS24 = "https://trends24.in";
const COUNTRY_SLUG = {
  sa: "saudi-arabia",
  ae: "united-arab-emirates",
  eg: "egypt",
  kw: "kuwait",
  qa: "qatar",
  bh: "bahrain",
  om: "oman"
};

async function getXTrends(country = "sa", limit = 10) {
  try {
    const slug = COUNTRY_SLUG[country] || "saudi-arabia";
    const url = `${TRENDS24}/${slug}/`;

    const { data } = await axios.get(url, { headers: { "User-Agent": UA } });
    const $ = cheerio.load(data);

    const trends = [];
    $(".trend-card .trend-card__list li a").each((_, a) => {
      const t = $(a).text().trim();
      if (!t || /^more/i.test(t)) return;
      trends.push(t);
    });

    const top = trends.slice(0, limit);
    if (!top.length) return [{ title: "تعذّر جلب ترند X حالياً", link: "" }];

    return top.map((t) => ({
      title: t,
      link: `https://x.com/search?q=${encodeURIComponent(t)}&src=trend_click`
    }));
  } catch (e) {
    return [{ title: "خطأ أثناء جلب ترند X", link: "" }];
  }
}

// ------------------ Instagram via best-hashtags ------------------
const BEST_HASHTAGS = "https://best-hashtags.com/hashtag/";
const IG_TOPIC = {
  sa: "saudiarabia",
  ae: "uae",
  eg: "egypt",
  kw: "kuwait",
  qa: "qatar",
  bh: "bahrain",
  om: "oman"
};

async function getInstagramHashtags(country = "sa", limit = 20) {
  try {
    const topic = IG_TOPIC[country] || "saudiarabia";
    const url = `${BEST_HASHTAGS}${topic}/`;

    const { data } = await axios.get(url, { headers: { "User-Agent": UA } });
    const $ = cheerio.load(data);

    const text = $("#hashtags").text().trim();
    const tags = text.match(/#\w+/g) || [];

    return Array.from(new Set(tags)).slice(0, limit);
  } catch {
    return ["#saudiarabia", "#ksa", "#trend"];
  }
}

export { getXTrends, getInstagramHashtags };
