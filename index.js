// index.js — Trend Bot (Saudi only) — X (هاشتاقات برسالة واحدة) + Instagram (كروت) — بدون Google نهائيًا
import express from "express";
import { Telegraf, Markup } from "telegraf";
import {
  buildXTrendCards,
  buildInstagramCards
} from "./src/trends.js";
import * as Hashtags from "./src/hashtags.js";
import { buildUnifiedMessage } from "./src/ui_unified.js";

// ====== ENV ======
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) { console.error("❌ BOT_TOKEN missing"); process.exit(1); }
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || null;

const bot = new Telegraf(BOT_TOKEN);

// ====== ثابت: السعودية فقط ======
const SA = { code: "SA", cc: "sa", name: "🇸🇦 السعودية" };

// ====== Keyboards ======
function sourceKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("𝕏 Twitter — هاشتاقات برسالة واحدة", "src:tw")],
    [Markup.button.callback("📷 Instagram — كروت", "src:ig")]
  ]);
}

// ====== BOT COMMANDS ======
bot.start(ctx => ctx.reply("✅ جاهز للسعودية فقط. اكتب /trend لاختيار المصدر."));
bot.command("trend", ctx => ctx.reply(`اختر المصدر لـ ${SA.name}:`, sourceKeyboard()));

bot.action(/^src:(.+)$/, async ctx => {
  await ctx.answerCbQuery();
  const src = ctx.match[1];

  if (src === "tw") {
    await ctx.editMessageText(`جاري جلب ترند X في ${SA.name}...`);
    // هاشتاقات برسالة واحدة
    const tags = await Hashtags.getXHashtags(SA.cc, 10);
    if (!tags.length) {
      // احتياط: رجوع للكروت
      const cards = await buildXTrendCards(SA.cc, 10);
      if (!cards?.length) return ctx.reply("لا توجد نتائج حالياً.", { reply_markup: sourceKeyboard().reply_markup });
      await sendCards(ctx, cards);
      return ctx.reply("✔️ انتهى عرض ترند X.", { reply_markup: sourceKeyboard().reply_markup });
    }
    const html = buildUnifiedMessage({
      title: `ترند X — ${SA.name}`,
      sections: [{ label: "X", items: tags }]
    });
    return ctx.reply(html, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: sourceKeyboard().reply_markup
    });
  }

  if (src === "ig") {
    await ctx.editMessageText(`جاري جلب هاشتاقات إنستقرام لـ ${SA.name}...`);
    const cards = await buildInstagramCards(SA.cc, 10);
    if (!cards?.length) return ctx.reply("لا توجد نتائج حالياً.", { reply_markup: sourceKeyboard().reply_markup });
    await sendCards(ctx, cards);
    return ctx.reply("✔️ انتهى عرض هاشتاقات إنستقرام.", { reply_markup: sourceKeyboard().reply_markup });
  }

  return ctx.reply("💡 مصدر غير معروف.", { reply_markup: sourceKeyboard().reply_markup });
});

// زر "نسخ" — يرسل نصًا جاهزًا للنسخ (Telegram لا ينسخ تلقائي)
bot.action(/^copy_(.+)$/, async ctx => {
  await ctx.answerCbQuery("تم تجهيز النص للنسخ");
  const q = ctx.match[1];
  await ctx.reply(`📋 انسخ هذا النص:\n${q}`);
});

// ====== إرسال الكروت بدُفعات ======
async function sendCards(ctx, cards = []) {
  const chunk = (arr, n) => arr.reduce((a,_,i)=> (i%n? a[a.length-1].push(arr[i]) : a.push([arr[i]]), a), []);
  for (const group of chunk(cards, 5)) {
    const text = group.map(c => c.text).join("\n\n");
    const kb = { inline_keyboard: group.at(-1)?.reply_markup?.inline_keyboard || [] };
    await ctx.reply(text, { parse_mode: "Markdown", disable_web_page_preview: true, reply_markup: kb });
    await new Promise(r => setTimeout(r, 300));
  }
}

// ====== SERVER / WEBHOOK ======
const app = express();
app.get("/", (_, res) => res.send("✅ Bot is running (Saudi only)"));

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
