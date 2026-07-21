import "./load-env.js";
import { initSentryNode } from "@crm/shared/sentry-node";
import { startTelegramBot } from "./telegram";
import { log } from "./logger";

void initSentryNode("bot", process.env.BOT_SENTRY_DSN).then(() =>
  startTelegramBot()
  .then(() => {
    log.info("Telegram bot service is running");
  })
  .catch((error) => {
    log.error("Telegram bot service failed to start", { err: error });
    process.exitCode = 1;
  })
);
