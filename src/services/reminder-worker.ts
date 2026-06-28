import "dotenv/config";
import { startReminderScheduler } from "../reminders";
import { store } from "../store";

await store.load();
startReminderScheduler();

console.log("Reminder worker service is running");
