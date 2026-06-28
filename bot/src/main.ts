import "dotenv/config";
import { startTelegramBot } from "./telegram";

await startTelegramBot();

console.log("Telegram bot service is running");
