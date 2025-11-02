import TelegramBot from "node-telegram-bot-api";
import express from "express";

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: false });

const app = express();
app.use(express.json());

// Webhook endpoint
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Test response
bot.on("message", (msg) => {
  bot.sendMessage(msg.chat.id, "✅ البوت شغال بالويب هوك!");
});

// Default page
app.get("/", (req, res) => res.send("Bot Webhook Active"));

// Start server
app.listen(3000, () => console.log("Server running on port 3000"));
console.log("Webhook bot started");
