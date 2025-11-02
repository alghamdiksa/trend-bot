import TelegramBot from "node-telegram-bot-api";
import express from "express";
import Parser from "rss-parser";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is required");

const bot = new TelegramBot(token, { polling: false });
const app = express();
const parser = new Parser();

app.use(express.json());

// نقطة الويب هوك
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// مصادر RSS (الأول أساسي والثاني احتياطي)
const RSS_FALLBACKS = [
  "https://trends.google.com/trending/rss?geo=SA",
  "https://trends.google.com/trends/trendingsearches/daily/rss?geo=SA"
];

async function fetchTrendsRSS() {
  for (const url of RSS_FALLBACKS) {
    try {
      const feed = await parser.parseURL(url);
      if (feed?.items?.length) {
        return feed.items.slice(0, 10).map((it, i) => `${i + 1}️⃣ ${it.title}`);
      }
    } catch (_) {
      // جرّب الرابط التالي
    }
  }
  throw new Error("No RSS feed returned data");
}

// مزود احتياطي (اختياري) SearchAPI.io — فعّل إذا أضفت SEARCHAPI_KEY في Render
async function fetchTrendsSearchAPI() {
  const key = process.env.SEARCHAPI_KEY;
  if (!key) throw new Error("SEARCHAPI_KEY missing");
  const url = `https://www.searchapi.io/api/v1/search?engine=google_trends_trending_now&geo=SA&time=past_24_hours&api_key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`searchapi failed: ${res.status}`);
  const data = await res.json();
  const list = (data?.trends || []).slice(0, 10).map((t, i) => `${i + 1}️⃣ ${t.title}`);
  if (!list.length) throw new Error("empty trends from searchapi");
  return list;
}

// /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "✅ جاهز — أرسل /trend لجلب ترند السعودية 🇸🇦🔥");
});

// /trend
bot.onText(/\/trend/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const list = await fetchTrendsRSS();
    await bot.sendMessage(chatId, `🔥 ترند السعودية الآن:\n\n${list.join("\n")}`);
    return;
  } catch (_) { /* جرّب المزود الاحتياطي إن وُجد */ }

  try {
    const list = await fetchTrendsSearchAPI();
    await bot.sendMessage(chatId, `🔥 ترند السعودية الآن (API):\n\n${list.join("\n")}`);
  } catch (e) {
    console.error(e);
    await bot.sendMessage(chatId, "❌ تعذّر جلب الترند الآن. حاول لاحقًا.");
  }
});

// Healthcheck
app.get("/", (_req, res) => res.send("Bot Webhook Active ✅"));
app.listen(3000, () => console.log("Server running on port 3000"));
console.log("Webhook bot started");
