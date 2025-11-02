import TelegramBot from "node-telegram-bot-api";
import express from "express";
import Parser from "rss-parser";

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: false });

const app = express();
app.use(express.json());
const parser = new Parser();

// Telegram webhook endpoint
app.post(`/bot${token}`, (req, res) => { bot.processUpdate(req.body); res.sendStatus(200); });

// /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "✅ جاهز — أرسل /trend لجلب ترند السعودية 🇸🇦🔥");
});

// /trend
bot.onText(/\/trend/, async (msg) => {
  try {
    const feed = await parser.parseURL("https://trends.google.com/trends/trendingsearches/daily/rss?geo=SA");
    const top = feed.items.slice(0, 10).map((t, i) => `${i + 1}️⃣ ${t.title}`).join("\n");
    await bot.sendMessage(msg.chat.id, `🔥 ترند السعودية اليوم:\n\n${top}`);
  } catch (e) {
    console.error(e);
    await bot.sendMessage(msg.chat.id, "❌ تعذر جلب الترند الآن. حاول لاحقًا.");
  }
});

// Health
app.get("/", (_req, res) => res.send("Bot Webhook Active ✅"));
app.listen(3000, () => console.log("Server running on port 3000"));
console.log("Webhook bot started");
