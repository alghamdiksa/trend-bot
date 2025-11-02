import TelegramBot from "node-telegram-bot-api";
import express from "express";
import Parser from "rss-parser";

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: false });

const app = express();
app.use(express.json());

const parser = new Parser();

// Webhook endpoint
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// /start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "✅ البوت شغال — ارسل /trend لجلب ترند السعودية 🇸🇦🔥");
});

// /trend command
bot.onText(/\/trend/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const feed = await parser.parseURL("https://trends.google.com/trends/trendingsearches/daily/rss?geo=SA");
    const trends = feed.items.slice(0, 10).map((t, i) => `${i + 1}️⃣ ${t.title}`).join("\n");

    bot.sendMessage(chatId, `🔥 ترند السعودية اليوم:\n\n${trends}`);
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "❌ ما قدرت أجيب الترند. حاول لاحقًا.");
  }
});

// Default route
app.get("/", (req, res) => res.send("Bot Webhook Active ✅"));

// Start server
app.listen(3000, () => console.log("Server running on port 3000"));
console.log("Webhook bot started");
