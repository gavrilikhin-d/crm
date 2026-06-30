import "dotenv/config";
import { initSentryNode } from "@crm/shared/sentry-node";
import { startTelegramBot } from "./telegram";
import { log } from "./logger";

initSentryNode("bot");

void startTelegramBot()
  .then(() => {
    log.info("Telegram bot service is running");
  })
  .catch((error) => {
    log.error("Telegram bot service failed to start", { err: error });
    process.exitCode = 1;
  });
