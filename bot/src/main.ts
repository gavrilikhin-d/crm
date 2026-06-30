import "dotenv/config";
import { startTelegramBot } from "./telegram";
import { log } from "./logger";

void startTelegramBot()
  .then(() => {
    log.info("Telegram bot service is running");
  })
  .catch((error) => {
    log.error("Telegram bot service failed to start", { err: error });
    process.exitCode = 1;
  });
