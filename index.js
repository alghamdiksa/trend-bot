// index.js — Trend Bot (Google + X + Instagram) مع كروت عرض
// يحتاج: BOT_TOKEN و SEARCHAPI_KEY في المتغيرات البيئية
// يعتمد ملفات: package.json (type: module) + src/trends.js + src/ui_trend_card.js

import express from "express";
import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import {
  buildXTrendCards,
  buildInstagramCards
} from "./src/trends.js";

// ====== ENV ======
const BOT_TOKEN = process.env.BOT_TOKEN;
const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN missing");
  process.exit(1);
}
if (!SEARCHAPI_KEY) {
  console.error("❌ SEARCHAPI_KEY missing");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || null;

const bot = new Telegraf(BOT_TOKEN);

// ====== COUNTRIES ======
const COUNTRIES = {
  sa: { code: "SA", name: "🇸🇦 السعودية" },
  eg: { code: "EG", name: "🇪🇬 مصر" },
  ae: { code: "AE", name: "🇦🇪 الإمارات" },
  us: { code: "US", name: "🇺🇸 أمريكا" },
  gb: { code: "GB", name: "🇬🇧 بريطانيا" },
  in: { code: "IN", name: "🇮🇳 الهند" }
};

// ====== KEYBOARDS ======
function countryKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🇸🇦 السعودية", "country:sa"),
      Markup.button.callback("🇪🇬 مصر", "country:eg"),
      Markup.button.callback("🇦🇪 الإمارات", "country:ae")
    ],
    [
      Markup.button.callback("🇺🇸 أمريكا", "country:us"),
      Markup.button.callback("🇬🇧 بريطانيا", "country:gb"),
      Markup.button.callback("🇮🇳 الهند", "country:in")
    ]
  ]);
}

function sourceKeyboard(cc) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🔥 Google Trends", `src:google:${cc}`)],
    [
      Markup.button.callback("𝕏 Twitter", `src:tw:${cc}`),
      Markup.button.callback("📷 Instagram", `src:ig:${cc}`)
    ],
    [Markup.button.callback("⬅️ رجوع", "back:countries")]
  ]);
}

// ====== BOT COMMANDS ======
bot.start(ctx => ctx.reply("✅ جاهز. اكتب /trend لاختيار الدولة."));
bot.command("trend", ctx => ctx.reply("اختر الدولة:", countryKeyboard()));

// اختيار الدولة
bot.action(/^country:(.+)$/, async ctx => {
  await ctx.answerCbQuery();
  const cc = ctx.match[1];
  const meta = COUNTRIES[cc];
  if (!meta) return ctx.reply("الدولة غير مدعومة.");
  await ctx.editMessageText(`الدولة المختارة: ${meta.name}\nاختر المصدر:`, sourceKeyboard(cc));
});

// اختيار المصدر
bot.action(/^src:(.+):(.+)$/, async ctx => {
  await ctx.answerCbQuery();
  const src = ctx.match[1];     // google | tw | ig
  const cc = ctx.match[2];      // sa | eg | ...
  const meta = COUNTRIES[cc];
  if (!meta) return ctx.reply("الدولة غير مدعومة.");

  // Google Trends (نفس الأسلوب النصي الحالي)
  if (src === "google") {
    await ctx.editMessageText(`جاري جلب الترند في ${meta.name}...`);
    const text = await fetchGoogleTrends(meta.code, meta.name);
    return ctx.reply(text, {
      disable_web_page_preview: true,
      reply_markup: sourceKeyboard(cc).reply_markup
    });
  }

  // X (Twitter) — كروت
  if (src === "tw") {
    await ctx.editMessageText(`جاري جلب ترند X في ${meta.name}...`);
    const cards = await buildXTrendCards(cc, 10);
    if (!cards?.length) {
      return ctx.reply("لا توجد نتائج حالياً.", { reply_markup: sourceKeyboard(cc).reply_markup });
    }
    await sendCards(ctx, cards);
    return ctx.reply("✔️ انتهى عرض ترند X.", { reply_markup: sourceKeyboard(cc).reply_markup });
  }

  // Instagram — كروت هاشتاقات
  if (src === "ig") {
    await ctx.editMessageText(`جاري جلب هاشتاقات إنستقرام لـ ${meta.name}...`);
    const cards = await buildInstagramCards(cc, 10);
    if (!cards?.length) {
      return ctx.reply("لا توجد نتائج حالياً.", { reply_markup: sourceKeyboard(cc).reply_markup });
    }
    await sendCards(ctx, cards);
    return ctx.reply("✔️ انتهى عرض هاشتاقات إنستقرام.", { reply_markup: sourceKeyboard(cc).reply_markup });
  }

  return ctx.reply("💡 مصدر غير معروف.", { reply_markup: sourceKeyboard(cc).reply_markup });
});

// رجوع لاختيار الدولة
bot.action("back:countries", async ctx => {
  await ctx.answerCbQuery();
  ctx.editMessageText("اختر الدولة:", countryKeyboard());
});

// ====== Google Trends (SearchAPI.io) ======
async function fetchGoogleTrends(geoCode, countryName) {
  try {
    const url = "https://www.searchapi.io/api/v1/search";
    const params = {
      engine: "google_trends_trending_now",
      geo: geoCode,              // SA, EG, ...
      time: "past_24_hours",
      hl: "ar",
      api_key: SEARCHAPI_KEY
    };
    const { data } = await axios.get(url, { params });

    const items = Array.isArray(data?.trends) ? data.trends : [];
    if (!items.length) return `لا يوجد ترند متاح لـ ${countryName} الآن.`;

    const top = items.slice(0, 10);
    const enriched = await Promise.all(top.map(async (t, i) => {
      let link = "";
      if (t.news_token) {
        try {
          const { data: news } = await axios.get(url, {
            params: {
              engine: "google_trends_trending_now_news",
              news_token: t.news_token,
              api_key: SEARCHAPI_KEY
            }
          });
          link = news?.news?.[0]?.link || "";
        } catch (_) {}
      }
      const title = t.query || "غير معروف";
      return `${i + 1}. ${title}${link ? `\n${link}` : ""}`;
    }));

    return `🔥 ترند ${countryName} الآن:\n\n${enriched.join("\n\n")}`;
  } catch (e) {
    console.error("TREND ERROR:", e?.response?.data || e.message);
    return "⚠️ حصل خطأ أثناء جلب الترند.\nحاول مرة ثانية.";
  }
}

// ====== إرسال الكروت بتنسيق صحيح ======
async function sendCards(ctx, cards = []) {
  for (const c of cards) {
    // c = { text, reply_markup }
    await ctx.reply(c.text, { ...c, parse_mode: "Markdown", disable_web_page_preview: true });
    await sleep(250); // تهدئة بسيطة حتى لا يعتبرها تيليجرام سبام
  }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ====== SERVER / WEBHOOK ======
const app = express();
app.get("/", (_, res) => res.send("✅ Bot is running"));

(async () => {
  try {
    if (BASE_URL) {
      // Webhook على Render
      const middleware = await bot.createWebhook({ domain: BASE_URL });
      app.use(middleware);
      console.log(`✅ Webhook set at ${BASE_URL}`);
    } else {
      // Polling محلي
      await bot.launch();
      console.log("✅ Bot launched with polling");
    }
  } catch (err) {
    console.error("❌ Webhook/Polling init error:", err);
    process.exit(1);
  }

  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
})();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
