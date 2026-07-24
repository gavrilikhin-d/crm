import type { InlineKeyboardButton } from "@telegraf/types";

export function getInlineCallbackData(button: InlineKeyboardButton): string | undefined {
  return "callback_data" in button ? button.callback_data : undefined;
}
