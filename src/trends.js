// src/trends.js — resilient scraping with proxy fallback for Render
import axios from "axios";
import * as cheerio from "cheerio";
import { trendCard } from "./ui_trend_card.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const HDR = { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" } };

// ============ Helpers ============
async function fetchHtmlWithFallback(url) {
  try {
    const { data } = await axios.get(url, HDR);
    return String(data);
  } catch {
    const proxied = `https://r.jina.ai/http/${url.replace(/^https?:\/\//, "")}`;
    const { data } = await axios.get(proxied, HDR);
    return String(data);
  }
}

// ============ X (Twitter) via trends24 ============
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

export async function getXTrends(country = "sa", limit = 10) {
  try {
    const slug = COUNTRY_SLUG[country] || "saudi-arabia";
    const url = `${TRENDS24}/${slug}/`;

    const html = await fetchHtmlWithFallback(url);
    const $ = cheerio.load(html);

    const anchors =
      $(".trend-card .trend-card__list li a").toArray().length
        ? $(".trend-card .trend-card__list li a")
        : $("a");

    const raw = [];
    anchors.each((_, a) => {
      const t = $(a).text().trim();
      const href = String($(a).attr("href") || "");
      const junk = /^(about|contact|feedback|terms|privacy)$/i.test(t);
      const notForCountry = !href.includes(`/${slug}/`) && !href.startsWith("#");
      if (!t || junk || notForCountry) return;
      if (t.length > 80) return;
      raw.push(t);
    });

    const uniq = Array.from(new Set(raw)).slice(0, limit);
    if (!uniq.length) return [{ title: "تعذّر جلب ترند X حالياً", url: "", link: "" }];

    return uniq.map(t => {
      const searchUrl = `https://x.com/search?q=${encodeURIComponent(t)}&src=trend_click`;
      return { title: t, url: searchUrl, link: searchUrl };
    });
  } catch {
    return [{ title: "خطأ أثناء جلب ترند X", url: "", link: "" }];
  }
}

// ============ Instagram via best-hashtags ============
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

export async function getInstagramHashtags(country = "sa", limit = 20) {
  try {
    const topic = IG_TOPIC[country] || "saudiarabia";
    const url = `${BEST_HASHTAGS}${topic}/`;

    const html = await fetchHtmlWithFallback(url);
    const $ = cheerio.load(html);

    let text = $("#hashtags").text().trim();
    if (!text) text = $.root().text();

    const tags = (text.match(/#[\p{L}0-9_]+/gu) || []).map(t => t.toLowerCase());
    const uniq = Array.from(new Set(tags)).slice(0, limit);
    return uniq.length ? uniq : ["#saudiarabia", "#ksa", "#trend"];
  } catch {
    return ["#saudiarabia", "#ksa", "#trend"];
  }
}

// ============ Google Trends Fallback (no SearchAPI) ============
export async function scrapeDailyTrends(geoCode = "SA", limit = 10) {
  const url = `https://trends.google.com/trends/trendingsearches/daily?geo=${encodeURIComponent(
    geoCode
  )}`;
  const html = await fetchHtmlWithFallback(url);
  const $ = cheerio.load(html);

  const titles = new Set();
  $("span.title, a").each((_, el) => {
    const t = $(el).text().trim();
    if (!t) return;
    if (t.length > 100) return;
    if (/^(more|learn more|about|searches)$/i.test(t)) return;
    titles.add(t);
  });

  const list = Array.from(titles).slice(0, limit);
  return list.map(q => ({
    title: q,
    url: `https://www.google.com/search?q=${encodeURIComponent(q)}`
  }));
}

// ============ Card builders ============
export async function buildXTrendCards(country = "sa", limit = 10) {
  const trends = await getXTrends(country, limit);
  return trends.map(t => trendCard({ title: t.title, url: t.url }, "X"));
}

export async function buildInstagramCards(country = "sa", limit = 10) {
  const tags = await getInstagramHashtags(country, limit);
  return tags.map(tag => {
    const clean = tag.replace(/^#/, "");
    const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(clean)}/`;
    return trendCard({ title: tag, url }, "Instagram");
  });
}
