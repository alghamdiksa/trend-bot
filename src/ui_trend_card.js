// وظيفة: تجهيز كرت عرض الترند بشكل مرتب
import { Markup } from "telegraf";

export function trendCard(trend, source) {
  const title = trend.title || "Trend";
  const url = trend.url || "#";

  return {
    text: `🔥 *${title}*\n📍 المصدر: ${source}\n🔗 الرابط بالأسفل`,
    ...Markup.inlineKeyboard([
      [Markup.urlButton("🔎 بحث", url)],
      [
        Markup.callbackButton("📋 نسخ", `copy_${title}`),
        Markup.urlButton("📤 مشاركة", url)
      ]
    ])
  };
}

