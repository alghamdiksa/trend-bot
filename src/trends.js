// src/trends.js — resilient scraping with proxy fallback for Render
import axios from "axios";
import * as cheerio from "cheerio";
import { trendCard } from "./ui_trend_card.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const HDR = { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" } };

// ------------------ X (Twitter) via trends24 ------------------
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

// Try direct fetch then fallback to proxy reader
async function fetchHtmlWithFallback(url) {
  try {
    const { data } = await axios.get(url, HDR);
    return String(data);
  } catch {
    // proxy via r.jina.ai to bypass CF blocks on Render
    const proxied = `https://r.jina.ai/http/${url.replace(/^https?:\/\//, "")}`;
    const { data } = await axios.get(proxied, HDR);
    return String(data);
  }
}

async function getXTrends(country = "sa", limit = 10) {
  try {
    const slug = COUNTRY_SLUG[country] || "saudi-arabia";
    const url = `${TRENDS24}/${slug}/`;

    const html = await fetchHtmlWithFallback(url);
    const $ = cheerio.load(html);

    // Select both original site structure and simplified proxy HTML
    const anchors =
      $(".trend-card .trend-card__list li a").toArray().length
        ? $(".trend-card .trend-card__list li a")
        : $("a"); // broad fallback

    const raw = [];
    anchors.each((_, a) => {
      const t = $(a).text().trim();
      if (!t || /^more/i.test(t)) return;
      if (t.length > 80) return; // skip very long junk
      raw.push(t);
    });

    const uniq = Array.from(new Set(raw)).slice(0, limit);
    if (!uniq.length)
      return [{ title: "تعذّر جلب ترند X حالياً", url: "", link: "" }];

    return uniq.map((t) => {
      const searchUrl = `https://x.com/search?q=${encodeURIComponent(t)}&src=trend_click`;
      return { title: t, url: searchUrl, link: searchUrl }; // url + link للتوافق
    });
  } catch {
    return [{ title: "خطأ أثناء جلب ترند X", url: "", link: "" }];
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
  om: "oman",
};

async function getInstagramHashtags(country = "sa", limit = 20) {
  try {
    const topic = IG_TOPIC[country] || "saudiarabia";
    const url = `${BEST_HASHTAGS}${topic}/`;

    const html = await fetchHtmlWithFallback(url);
    const $ = cheerio.load(html);

    // Prefer original #hashtags block; else parse all text for hashtags
    let text = $("#hashtags").text().trim();
    if (!text) text = $.root().text(); // proxy fallback

    const tags = (text.match(/#[\p{L}0-9_]+/gu) || []).map((t) => t.toLowerCase());

    const uniq = Array.from(new Set(tags)).slice(0, limit);
    return uniq.length ? uniq : ["#saudiarabia", "#ksa", "#trend"];
  } catch {
    return ["#saudiarabia", "#ksa", "#trend"];
  }
}

// ------------------ Builders: كروت جاهزة للإرسال ------------------
// ترجع مصفوفة كروت Telegraf جاهزة من ترند X
async function buildXTrendCards(country = "sa", limit = 10) {
  const trends = await getXTrends(country, limit);
  return trends.map((t) => trendCard({ title: t.title, url: t.url }, "X"));
}

// ترجع مصفوفة كروت Telegraf جاهزة من إنستغرام (هاشتاقات)
async function buildInstagramCards(country = "sa", limit = 10) {
  const tags = await getInstagramHashtags(country, limit);
  return tags.map((tag) => {
    const clean = tag.replace(/^#/, "");
    const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(clean)}/`;
    return trendCard({ title: tag, url }, "Instagram");
  });
}

export { getXTrends, getInstagramHashtags, buildXTrendCards, buildInstagramCards };
