import express from "express";
import { Telegraf, Markup } from "telegraf";
import googleTrends from "google-trends-api";

// ====== ENV ======
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN مفقود");
  process.exit(1);
}
const PORT = process.env.PORT || 3000;
const BASE_URL =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.BASE_URL ||
  null;

// ====== BOT ======
const bot = new Telegraf(BOT_TOKEN, { handlerTimeout: 90_000 });

// الدول (زرار)
const COUNTRIES = {
  sa: { geo: "SA", name: "السعودية 🇸🇦" },
  eg: { geo: "EG", name: "مصر 🇪🇬" },
  ae: { geo: "AE", name: "الإمارات 🇦🇪" },
  us: { geo: "US", name: "أمريكا 🇺🇸" },
  gb: { geo: "GB", name: "بريطانيا 🇬🇧" },
  in: { geo: "IN", name: "الهند 🇮🇳" }
};

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
    [Markup.button.callback("⬅️ رجوع للدول", "back:countries")]
  ]);
}

bot.start(ctx =>
  ctx.reply("✅ البوت جاهز. اكتب /trend لاختيار الدولة والمصدر.")
);

bot.command("trend", async ctx => {
  await ctx.reply("اختر الدولة:", countryKeyboard());
});

// اختيار الدولة
bot.action(/^country:(.+)$/, async ctx => {
  await ctx.answerCbQuery();
  const cc = ctx.match[1];
  const meta = COUNTRIES[cc];
  if (!meta) return ctx.reply("الدولة غير مدعومة الآن.");
  await ctx.editMessageText(
    `الدولة المختارة: ${meta.name}\nاختر المصدر:`,
    sourceKeyboard(cc)
  );
});

// اختيار المصدر
bot.action(/^src:(.+):(.+)$/, async ctx => {
  try {
    await ctx.answerCbQuery();
    const src = ctx.match[1]; // google | yt | tw
    const cc = ctx.match[2];
    const meta = COUNTRIES[cc];
    if (!meta) return ctx.reply("الدولة غير مدعومة.");

    if (src === "google") {
      await ctx.editMessageText(`جارِ جلب ترند ${meta.name} من Google Trends...`);
      const text = await fetchGoogleTrends(meta.geo, meta.name);
      return ctx.reply(text, { disable_web_page_preview: true });
    }

    return ctx.reply("هذا المصدر سيُفعّل قريبًا. المتاح الآن: Google Trends.");
  } catch (e) {
    console.error(e);
    return ctx.reply("حصل خطأ غير متوقع.");
  }
});

// زر الرجوع
bot.action("back:countries", async ctx => {
  await ctx.answerCbQuery();
  await ctx.editMessageText("اختر الدولة:", countryKeyboard());
});

// ====== Google Trends (الإصدار الصحيح: dailyTrends) ======
async function fetchGoogleTrends(geo, countryName) {
  try {
    const res = await googleTrends.dailyTrends({
      trendDate: new Date(),
      geo
    });

    const data = JSON.parse(res);
    const list =
      data?.default?.trendingSearchesDays?.[0]?.trendingSearches || [];

    if (!list.length) {
      return `لا توجد بيانات ترند متاحة لـ ${countryName} اليوم.`;
    }

    const top = list.slice(0, 10).map((item, i) => {
      const title = item.title?.query || "غير معروف";
      const url = item?.articles?.[0]?.url || "";
      return `${i + 1}. ${title}${url ? `\n   ${url}` : ""}`;
    });

    return `🔥 ترند ${countryName} الآن:\n\n${top.join("\n\n")}`;
  } catch (err) {
    console.error("DailyTrendsError:", err);
    return "تعذر جلب الترند من Google Trends حالياً.";
  }
}

// ====== SERVER / WEBHOOK ======
const app = express();
app.get("/", (_, res) => res.send("Trend bot is alive."));

if (BASE_URL) {
  const secretPath = `/telegraf/${bot.secretPathComponent()}`;
  app.use(bot.webhookCallback(secretPath));
  bot.telegram
    .setWebhook(`${BASE_URL}${secretPath}`)
    .then(() => console.log("✅ Webhook متصل:", `${BASE_URL}${secretPath}`))
    .catch(err => console.error("❌ Webhook Error", err));
} else {
  bot.launch().then(() => console.log("✅ Bot launched with polling"));
}

app.listen(PORT, () =>
  console.log(`HTTP server on :${PORT} ${BASE_URL ? "(webhook)" : "(polling)"}`)
);

// إطفاء نظيف
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
