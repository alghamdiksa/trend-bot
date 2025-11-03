// index.js — Trend Bot (Google + X + Instagram) مع كروت عرض + Fallback وبثّ مجمّع
import express from "express";
import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import {
  buildXTrendCards,
  buildInstagramCards,
  scrapeDailyTrends
} from "./src/trends.js";

// ====== ENV ======
const BOT_TOKEN = process.env.BOT_TOKEN;
const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY;

if (!BOT_TOKEN) { console.error("❌ BOT_TOKEN missing"); process.exit(1); }
// نكمّل حتى لو SEARCHAPI_KEY ناقص لأن عندنا Fallback
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

// ====== Keyboards ======
function countryKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🇸🇦 السعودية", "country:sa"),
     Markup.button.callback("🇪🇬 مصر", "country:eg"),
     Markup.button.callback("🇦🇪 الإمارات", "country:ae")],
    [Markup.button.callback("🇺🇸 أمريكا", "country:us"),
     Markup.button.callback("🇬🇧 بريطانيا", "country:gb"),
     Markup.button.callback("🇮🇳 الهند", "country:in")]
  ]);
}
function sourceKeyboard(cc) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🔥 Google Trends", `src:google:${cc}`)],
    [Markup.button.callback("𝕏 Twitter", `src:tw:${cc}`),
     Markup.button.callback("📷 Instagram", `src:ig:${cc}`)],
    [Markup.button.callback("⬅️ رجوع", "back:countries")]
  ]);
}

// ====== BOT COMMANDS ======
bot.start(ctx => ctx.reply("✅ جاهز. اكتب /trend لاختيار الدولة."));
bot.command("trend", ctx => ctx.reply("اختر الدولة:", countryKeyboard()));

bot.action(/^country:(.+)$/, async ctx => {
  await ctx.answerCbQuery();
  const cc = ctx.match[1];
  const meta = COUNTRIES[cc];
  if (!meta) return ctx.reply("الدولة غير مدعومة.");
  await ctx.editMessageText(`الدولة المختارة: ${meta.name}\nاختر المصدر:`, sourceKeyboard(cc));
});

bot.action(/^src:(.+):(.+)$/, async ctx => {
  await ctx.answerCbQuery();
  const src = ctx.match[1];
  const cc = ctx.match[2];
  const meta = COUNTRIES[cc];
  if (!meta) return ctx.reply("الدولة غير مدعومة.");

  if (src === "google") {
    await ctx.editMessageText(`جاري جلب الترند في ${meta.name}...`);
    const text = await fetchGoogleTrendsSmart(meta.code, meta.name);
    return ctx.reply(text, { disable_web_page_preview: true, reply_markup: sourceKeyboard(cc).reply_markup });
  }

  if (src === "tw") {
    await ctx.editMessageText(`جاري جلب ترند X في ${meta.name}...`);
    const cards = await buildXTrendCards(cc, 10);
    if (!cards?.length) return ctx.reply("لا توجد نتائج حالياً.", { reply_markup: sourceKeyboard(cc).reply_markup });
    await sendCards(ctx, cards);
    return ctx.reply("✔️ انتهى عرض ترند X.", { reply_markup: sourceKeyboard(cc).reply_markup });
  }

  if (src === "ig") {
    await ctx.editMessageText(`جاري جلب هاشتاقات إنستقرام لـ ${meta.name}...`);
    const cards = await buildInstagramCards(cc, 10);
    if (!cards?.length) return ctx.reply("لا توجد نتائج حالياً.", { reply_markup: sourceKeyboard(cc).reply_markup });
    await sendCards(ctx, cards);
    return ctx.reply("✔️ انتهى عرض هاشتاقات إنستقرام.", { reply_markup: sourceKeyboard(cc).reply_markup });
  }

  return ctx.reply("💡 مصدر غير معروف.", { reply_markup: sourceKeyboard(cc).reply_markup });
});

bot.action("back:countries", async ctx => {
  await ctx.answerCbQuery();
  ctx.editMessageText("اختر الدولة:", countryKeyboard());
});

// زر "نسخ" — يرسل نصًا جاهزًا للنسخ (Telegram لا ينسخ تلقائي)
bot.action(/^copy_(.+)$/, async ctx => {
  await ctx.answerCbQuery("تم تجهيز النص للنسخ");
  const q = ctx.match[1];
  await ctx.reply(`📋 انسخ هذا النص:\n${q}`);
});

// ====== Google Trends (مع Fallback تلقائي) ======
async function fetchGoogleTrendsSmart(geoCode, countryName) {
  try {
    const url = "https://www.searchapi.io/api/v1/search";
    const params = {
      engine: "google_trends_trending_now",
      geo: geoCode,
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
        } catch {}
      }
      const title = t.query || "غير معروف";
      return `${i + 1}. ${title}${link ? `\n${link}` : ""}`;
    }));

    return `🔥 ترند ${countryName} الآن:\n\n${enriched.join("\n\n")}`;
  } catch {
    // إذا خلصت الحصة أو صار خطأ، نستخدم Fallback المجاني
    const fallback = await scrapeDailyTrends(geoCode, 10);
    if (!fallback.length) return "⚠️ تعذّر جلب ترند Google حاليًا.";
    const lines = fallback.map((t, i) => `${i + 1}. ${t.title}\n${t.url}`).join("\n\n");
    return `🔥 ترند ${countryName} (Fallback):\n\n${lines}`;
  }
}

// ====== إرسال الكروت بدُفعات ======
async function sendCards(ctx, cards = []) {
  // نقسّم الكروت إلى مجموعات كل مجموعة 5 كروت ونرسل كل مجموعة برسالة واحدة
  const chunk = (arr, n) => arr.reduce((a,_,i)=> (i%n? a[a.length-1].push(arr[i]) : a.push([arr[i]]), a), []);
  for (const group of chunk(cards, 5)) {
    const text = group.map(c => c.text).join("\n\n");
    // نستخدم أزرار آخر كرت في المجموعة كلوحة سفلية موحّدة
    const kb = { inline_keyboard: group.at(-1)?.reply_markup?.inline_keyboard || [] };
    await ctx.reply(text, { parse_mode: "Markdown", disable_web_page_preview: true, reply_markup: kb });
    await sleep(300);
  }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ====== SERVER / WEBHOOK ======
const app = express();
app.get("/", (_, res) => res.send("✅ Bot is running"));

(async () => {
  try {
    if (BASE_URL) {
      const middleware = await bot.createWebhook({ domain: BASE_URL });
      app.use(middleware);
      console.log(`✅ Webhook set at ${BASE_URL}`);
    } else {
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
