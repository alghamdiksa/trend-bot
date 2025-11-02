import express from "express";
import { Telegraf, Markup } from "telegraf";
import axios from "axios";

// ====== ENV ======
const BOT_TOKEN = process.env.BOT_TOKEN;
const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN مفقود");
  process.exit(1);
}
if (!SEARCHAPI_KEY) {
  console.error("❌ SEARCHAPI_KEY مفقود");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const BASE_URL =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.BASE_URL ||
  null;

// ====== BOT ======
const bot = new Telegraf(BOT_TOKEN, { handlerTimeout: 90_000 });

// الدول (زرار + أكواد SearchAPI)
const COUNTRIES = {
  sa: { code: "sa", name: "السعودية 🇸🇦" },
  eg: { code: "eg", name: "مصر 🇪🇬" },
  ae: { code: "ae", name: "الإمارات 🇦🇪" },
  us: { code: "us", name: "أمريكا 🇺🇸" },
  gb: { code: "gb", name: "بريطانيا 🇬🇧" },
  in: { code: "in", name: "الهند 🇮🇳" }
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
    [Markup.button.callback("🔥 Google Trends (Realtime)", `src:google:${cc}`)],
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
    const src = ctx.match[1];
    const cc = ctx.match[2];
    const meta = COUNTRIES[cc];
    if (!meta) return ctx.reply("الدولة غير مدعومة.");

    if (src === "google") {
      await ctx.editMessageText(`جارِ جلب ترند ${meta.name}...`);
      const text = await fetchTrends(meta.code, meta.name);
      return ctx.reply(text, { disable_web_page_preview: true });
    }

    return ctx.reply("هذا المصدر قريبًا. شغال الآن: Google Trends فقط.");
  } catch (e) {
    console.error(e);
    return ctx.reply("حصل خطأ غير متوقع.");
  }
});

// رجوع للدول
bot.action("back:countries", async ctx => {
  await ctx.answerCbQuery();
  await ctx.editMessageText("اختر الدولة:", countryKeyboard());
});

// ====== SearchAPI Trends ======
async function fetchTrends(code, countryName) {
  try {
    const url = `https://www.searchapi.io/api/v1/search?engine=google_trends&geo=${code}&api_key=${SEARCHAPI_KEY}`;

    const res = await axios.get(url);
    const items = res.data?.trending_searches || [];

    if (!items.length) return `لا يوجد ترند متاح لـ ${countryName}.`;

    const top = items.slice(0, 10).map((item, i) => {
      const title = item.title || "غير معروف";
      const url = item?.articles?.[0]?.url || "";
      return `${i + 1}. ${title}${url ? `\n   ${url}` : ""}`;
    });

    return `🔥 ترند ${countryName} الآن:\n\n${top.join("\n\n")}`;
  } catch (err) {
    console.error(err);
    return "⚠️ تعذر جلب الترند حالياً. جرب بعد قليل.";
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

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
