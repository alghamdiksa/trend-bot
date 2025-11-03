// src/ui_trend_card.js
import { Markup } from "telegraf";

// نهرب رموز Markdown حتى ما ينكسر التنسيق
const escapeMd = s => String(s).replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");

export function trendCard(trend, source) {
  const titleRaw = trend.title || "Trend";
  const url = trend.url || "#";

  const title = escapeMd(titleRaw);
  const src = escapeMd(source);

  return {
    text: `🔥 *${title}*\n📍 المصدر: ${src}\n🔗 الرابط بالأسفل`,
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.url("🔎 بحث", url)],
      [
        Markup.button.callback("📋 نسخ", `copy_${titleRaw}`),
        Markup.button.url("📤 مشاركة", url)
      ]
    ])
  };
}
