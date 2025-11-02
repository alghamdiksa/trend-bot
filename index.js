import express from "express";
import { Telegraf, Markup } from "telegraf";
import googleTrends from "google-trends-api";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN مفقود");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const BASE_URL =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.BASE_URL || // عيّنه يدويًا إن لزم
  null;

const bot = new Telegraf(BOT_TOKEN, { handlerTimeout: 9_0000 });

// خريطة الدول: كود قصير -> كود Google Trends
const COUNTRIES = {
  sa: { geo: "SA", name: "السعودية 🇸🇦" },
  eg: { geo: "EG", name: "مصر 🇪🇬" },
  ae: { geo: "AE", name: "الإمارات 🇦🇪" },
  us: { geo: "US", name: "أمريكا 🇺🇸" },
  gb: { geo: "GB", name: "بريطانيا 🇬🇧" },
  in: { geo: "IN", name: "الهند 🇮🇳" }
};

// زرار اختيار الدولة
function countryKeyboard() {
  const rows = [
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
  ];
  return Markup.inlineKeyboard(rows);
}

// زرار اختيار المصدر
function sourceKeyboard(cc) {
  const rows = [
    [Markup.button.callback("🔥 Google Trends", `src:google:${cc}`)],
    [
      Markup.button.callback("▶️ YouTube (قريبًا)", `src:yt:${cc}`),
      Markup.button.callback("𝕏 Twitter (قريبًا)", `src:tw:${cc}`)
    ],
    [Markup.button.callback("⬅️ رجوع للدول", "back:countries")]
  ];
  return Markup.inlineKeyboard(rows);
}

bot.start(ctx =>
  ctx.reply(
    "✅ البوت جاهز. اكتب /trend لاختيار الدولة والمصدر.",
  )
);

bot.command("trend", async ctx => {
  await ctx.reply("اختر الدولة:", countryKeyboard());
});

// المرحلة 1: استلام الدولة
bot.action(/^country:(.+)$/, async ctx => {
  try {
    await ctx.answerCbQuery();
    const cc = ctx.match[1];
    const meta = COUNTRIES[cc];
    if (!meta) {
      return ctx.reply("الدولة غير مدعومة الآن.");
    }
    await ctx.editMessageText(
      `الدولة المختارة: ${meta.name}\nاختر المصدر:`,
      sourceKeyboard(cc)
    );
  } catch (e) {
    console.error(e);
  }
});

// المرحلة 2: استلام المصدر
bot.action(/^src:(.+):(.+)$/, async ctx => {
  try {
    await ctx.answerCbQuery();
    const src = ctx.match[1]; // google | yt | tw
    const cc = ctx.match[2];
    const { geo, name } = COUNTRIES[cc] || {};
    if (!geo) return ctx.reply("الدولة غير مدعومة.");

    if (src === "google") {
      await ctx.editMessageText(
        `جارِ جلب ترند ${name} من Google Trends...`
      );
      const text = await fetchGoogleTrends(geo, name);
      return ctx.reply(text, { disable_web_page_preview: true });
    }

    // المصادر الأخرى Placeholder
    return ctx.reply(
      "المصدر هذا سيُفعّل قريبًا. حالياً Google Trends يعمل بشكل كامل."
    );
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

// Google Trends: أعلى عمليات البحث اليومية
async function fetchGoogleTrends(geo, countryName) {
  try {
    const res = await googleTrends.trendingSearches({
      geo, // بعض البلدان لا تدعم dailyTrends بالضبط؛ هذه تجيب الشائع اليوم
      // trendDate: new Date()  // يمكن تحديد تاريخ إذا رغبت
    });

    const data = JSON.parse(res);
    const list =
      data?.default?.trendingSearchesDays?.[0]?.trendingSearches || [];

    if (!list.length) {
      return `لا توجد بيانات ترند متاحة اليوم لـ ${countryName}.`;
    }

    const top = list.slice(0, 10).map((item, i) => {
      const title = item.title?.query || "غير معروف";
      const articles = item?.articles?.[0]?.url || "";
      const num = i + 1;
      return `${num}. ${title}${articles ? `\n   ${articles}` : ""}`;
    });

    return `🔥 ترند ${countryName} الآن:\n\n${top.join("\n\n")}`;
  } catch (err) {
    console.error("GoogleTrendsError:", err);
    return "تعذر جلب الترند من Google Trends حالياً.";
  }
}

// تشغيل: Webhook على Render أو Polling محلي
const app = express();
if (BASE_URL) {
  const secretPath = `/telegraf/${bot.secretPathComponent()}`;
  app.use(bot.webhookCallback(secretPath));
  bot.telegram.setWebhook(`${BASE_URL}${secretPath}`)
    .then(() => console.log("✅ Webhook متصل:", `${BASE_URL}${secretPath}`))
    .catch(err => console.error("❌ Webhook Error", err));
} else {
  // بدون BASE_URL نشتغل Polling (محلي)
  bot.launch().then(() => console.log("✅ Bot launched with polling"));
}

app.get("/", (_, res) => res.send("Trend bot is alive."));
app.listen(PORT, () =>
  console.log(`HTTP server on :${PORT} ${BASE_URL ? "(webhook)" : "(polling)"}`)
);

// إطفاء نظيف
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
