// package.json يجب أن يحتوي: { "type": "module" }
import express from "express";
import { Telegraf, Markup } from "telegraf";
import axios from "axios";

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
      Markup.button.callback("▶️ YouTube (قريبًا)", `src:yt:${cc}`),
      Markup.button.callback("𝕏 Twitter (قريبًا)", `src:tw:${cc}`)
    ],
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
    const text = await fetchTrends(meta.code, meta.name);
    return ctx.reply(text, { disable_web_page_preview: true });
  }
  return ctx.reply("💡 قريبًا YouTube / Twitter\nالمتاح الآن: Google Trends فقط ✅");
});

bot.action("back:countries", async ctx => {
  await ctx.answerCbQuery();
  ctx.editMessageText("اختر الدولة:", countryKeyboard());
});

// ====== FETCH TRENDS ======
async function fetchTrends(geoCode, countryName) {
  try {
    // 1) Trending Now
    const url = "https://www.searchapi.io/api/v1/search";
    const params = {
      engine: "google_trends_trending_now",
      geo: geoCode,        // يجب أن تكون بصيغة US, SA, EG ...
      time: "past_24_hours",
      hl: "ar",
      api_key: SEARCHAPI_KEY
    };
    const { data } = await axios.get(url, { params });

    const items = Array.isArray(data?.trends) ? data.trends : [];
    if (!items.length) return `لا يوجد ترند متاح لـ ${countryName} الآن.`;

    // 2) اجلب أول خبر لكل عنصر باستخدام news_token
    const top = items.slice(0, 10);
    const enriched = await Promise.all(top.map(async (t, i) => {
      let link = "";
      const newsToken = t.news_token;
      if (newsToken) {
        try {
          const newsRes = await axios.get(url, {
            params: {
              engine: "google_trends_trending_now_news",
              news_token: newsToken,
              api_key: SEARCHAPI_KEY
            }
          });
          const first = newsRes?.data?.news?.[0];
          link = first?.link || "";
        } catch (_) {
          // تجاهل خطأ الخبر، نعرض الترند فقط
        }
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
