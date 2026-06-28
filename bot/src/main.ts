import "dotenv/config";
import { startTelegramBot } from "./telegram";

void startTelegramBot()
  .then(() => {
    console.log("Telegram bot service is running");
  })
  .catch((error) => {
    console.error("Telegram bot service failed to start:", error);
    process.exitCode = 1;
  });
