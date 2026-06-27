import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { startReminderScheduler } from "./reminders";
import { store } from "./store";
import { startTelegramBot } from "./telegram";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOSTNAME ?? "localhost";
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();
await store.load();

createServer((req, res) => {
  void handle(req, res);
}).listen(port, () => {
  console.log(`CRM app is running on http://${hostname}:${port}`);
  startReminderScheduler();
  void startTelegramBot();
});
