import "dotenv/config";
import { store } from "../store";
import { startTelegramBot } from "../telegram";

await store.load();
await startTelegramBot();

console.log("Telegram bot service is running");
