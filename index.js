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
const BASE_URL =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.BASE_URL ||
  null;

const bot = new Telegraf(BOT_TOKEN);

// ====== Countries ======
const COUNTRIES = {
  sa: { code: "sa", name: "🇸🇦 السعودية" },
  eg: { code: "eg", name: "🇪🇬 مصر" },
  ae: { code: "ae", name: "🇦🇪 الإمارات" },
  us: { code: "us", name: "🇺🇸 أمريكا" },
  gb: { code: "gb", name: "🇬🇧 بريطانيا" },
  in: { code: "in", name: "🇮🇳 الهند" }
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
    [Markup.button.callback("⬅️ رجوع", "back:countries")]
  ]);
}

// ====== START ======
bot.start(ctx => ctx.reply("✅ جاهز. اكتب /trend لاختيار الدولة."));

bot.command("trend", ctx => ctx.reply("اختر الدولة:", countryKeyboard()));

// ====== Country selected ======
bot.action(/^country:(.+)$/, async ctx => {
  await ctx.answerCbQuery();
  const cc = ctx.match[1];
  const meta = COUNTRIES[cc];
  if (!meta) return ctx.reply("الدولة غير مدعومة.");

  await ctx.editMessageText(
    `الدولة المختارة: ${meta.name}\nاختر المصدر:`,
    sourceKeyboard(cc)
  );
});

// ====== Source selected ======
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

  return ctx.reply("💡 هذا المصدر قريبًا.\nالمتاح الآن: Google Trends فقط.");
});

// ====== Back ======
bot.action("back:countries", async ctx => {
  await ctx.answerCbQuery();
  ctx.editMessageText("اختر الدولة:", countryKeyboard());
});

// ====== Fetch Trends via SearchAPI ======
async function fetchTrends(code, countryName) {
  try {
    const url = `https://www.searchapi.io/api/v1/search?engine=google_trends_trending_now&geo=${code}&hl=ar&api_key=${SEARCHAPI_KEY}`;

    const res = await axios.get(url);
    const items = res.data.trending_searches || [];

    if (!items.length)
      return `لا يوجد ترند متاح لـ ${countryName} الآن.`;

    const top = items.slice(0, 10).map((item, i) => {
      const title = item.title || "غير معروف";
      const link = item?.articles?.[0]?.url || "";
      return `${i + 1}. ${title}${link ? `\n${link}` : ""}`;
    });

    return `🔥 ترند ${countryName} الآن:\n\n${top.join("\n\n")}`;
  } catch (e) {
    console.error(e);
    return "⚠️ حدث خطأ أثناء جلب الترند. حاول لاحقًا.";
  }
}

// ====== Server / Webhook ======
const app = express();
app.get("/", (_, res) => res.send("✅ Trend bot is running"));

if (BASE_URL) {
  const secret = `/telegraf/${bot.secretPathComponent()}`;
  app.use(bot.webhookCallback(secret));
  bot.telegram.setWebhook(`${BASE_URL}${secret}`);
} else {
  bot.launch();
}

app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
