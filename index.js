import TelegramBot from "node-telegram-bot-api";
import express from "express";

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
bot.on("message", (msg) => bot.sendMessage(msg.chat.id, "✅ البوت شغال!"));

const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(3000);
