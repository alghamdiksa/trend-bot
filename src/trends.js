// src/trends.js
import axios from "axios";

// ملاحظة: غيّر مصادر الجلب حسب ما كنت تستخدمه سابقاً.
// هنا نفترض أن لديك مفاتيح/نقاط نهاية جاهزة أو من مزود خارجي.

export async function getXTrends() {
  // ارجع مصفوفة من: { tag: "#Example", url: "https://twitter.com/hashtag/Example" }
  // عدّل الجلب الحقيقي هنا ثم نظّف الخرج إلى هاشتاقات فقط
  const raw = await fetchXSomehow(); // ضع دالتك الحالية بدل هذا
  const unique = new Set();
  const items = [];

  for (const t of raw.slice(0, 15)) {
    // نحاول استخراج هاشتاق فقط
    const clean = (t.name || t.title || "").trim();
    if (!clean) continue;
    const hash = clean.startsWith("#") ? clean : `#${clean.replace(/\s+/g, "")}`;
    if (unique.has(hash.toLowerCase())) continue;
    unique.add(hash.toLowerCase());
    items.push({
      tag: hash,
      url: `https://twitter.com/hashtag/${encodeURIComponent(hash.replace("#", ""))}?src=trend_click`
    });
  }
  return items;
}

export async function getGoogleTrends() {
  // ارجع مصفوفة من: { tag: "#Keyword", url: "https://www.google.com/search?q=Keyword" }
  const raw = await fetchGoogleSomehow(); // ضع دالتك الحالية بدل هذا
  const unique = new Set();
  const items = [];

  for (const t of raw.slice(0, 15)) {
    const clean = (t.query || t.title || t.name || "").trim();
    if (!clean) continue;
    const normalized = clean.replace(/[#]+/g, "").replace(/\s+/g, "_");
    const hash = `#${normalized}`;
    if (unique.has(hash.toLowerCase())) continue;
    unique.add(hash.toLowerCase());
    items.push({
      tag: hash,
      url: `https://www.google.com/search?q=${encodeURIComponent(clean)}`
    });
  }
  return items;
}

// ضع دوال الجلب الفعلية هنا أو استوردها من كودك السابق
async function fetchXSomehow() { return []; }
async function fetchGoogleSomehow() { return []; }
