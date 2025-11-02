import TelegramBot from "node-telegram-bot-api";
import express from "express";
import googleTrends from "google-trends-api";

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: false });

const app = express();
app.use(express.json());

// Webhook endpoint
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// /start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "✅ جاهز! أرسل /trend لجلب ترند السعودية 🇸🇦🔥");
});

// /trend command
bot.onText(/\/trend/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const results = await googleTrends.dailyTrends({
      geo: "SA", // Saudi Arabia
    });

    const json = JSON.parse(results);
    const trends = json.default.trendingSearchesDays[0].trendingSearches
      .slice(0, 10) // Top 10 trends
      .map((item, i) => `${i + 1}️⃣ ${item.title.query}`)
      .join("\n");

    bot.sendMessage(chatId, `🔥 ترند السعودية اليوم:\n\n${trends}`);
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "❌ تعذر جلب الترند الآن. حاول لاحقًا.");
  }
});

// Test route
app.get("/", (req, res) => res.send("Bot Webhook Active ✅"));

// Start server
app.listen(3000, () => console.log("Server running on port 3000"));
console.log("Webhook bot started");
