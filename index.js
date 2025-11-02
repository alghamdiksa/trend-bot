import TelegramBot from "node-telegram-bot-api";
import express from "express";

const app = express();
app.get("/", (req, res) => res.send("Bot running"));

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

try {
  // احذف أي Webhook سابق وامسح الرسائل المعلقة
  await bot.deleteWebHook({ drop_pending_updates: true });
  await bot.startPolling();
  console.log("Polling started");
} catch (e) {
  console.error("Polling error:", e);
}

app.listen(3000, () => console.log("HTTP server on 3000"));
