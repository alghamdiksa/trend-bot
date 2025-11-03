// وظيفة: تجهيز كرت عرض الترند بشكل مرتب
import { Markup } from "telegraf";

export function trendCard(trend, source) {
  const title = trend.title || "Trend";
  const url = trend.url || "#";

  return {
    text: `🔥 *${title}*\n📍 المصدر: ${source}\n🔗 الرابط بالأسفل`,
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.url("🔎 بحث", url)],
      [
        Markup.button.callback("📋 نسخ", `copy_${title}`),
        Markup.button.url("📤 مشاركة", url)
      ]
    ])
  };
}
