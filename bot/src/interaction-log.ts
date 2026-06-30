import type { Context } from "telegraf";
import { log } from "./logger";
import type { BotReply } from "./messages";

type ChatKind = "private" | "group" | "supergroup" | "unknown";
type MessageKind = "plain_text" | "html_text" | "callback_toast" | "callback_alert" | "markup_cleared";
type InteractionOutcome = "ok" | "validation_error" | "not_linked" | "error" | "skipped";

type InteractionMeta = Record<string, string | number | boolean>;

type InteractionLogInput = {
  handler: string;
  chatKind: ChatKind;
  userId?: number;
  chatId?: number | string;
  messageKinds: MessageKind[];
  outcome?: InteractionOutcome;
  meta?: InteractionMeta;
};

function chatKindFromContext(ctx: Context): ChatKind {
  const type = ctx.chat?.type;
  if (type === "private" || type === "group" || type === "supergroup") {
    return type;
  }

  return "unknown";
}

function replyMessageKind(reply: BotReply): "plain_text" | "html_text" {
  return typeof reply === "string" ? "plain_text" : "html_text";
}

function logBotInteraction(input: InteractionLogInput): void {
  log.info("Bot interaction", {
    handler: input.handler,
    chatKind: input.chatKind,
    ...(input.userId !== undefined ? { userId: input.userId } : {}),
    ...(input.chatId !== undefined ? { chatId: input.chatId } : {}),
    messageKinds: input.messageKinds,
    outcome: input.outcome ?? "ok",
    ...(input.meta ?? {})
  });
}

class BotInteraction {
  readonly handler: string;
  readonly chatKind: ChatKind;
  readonly userId?: number;
  readonly chatId?: number | string;
  readonly messageKinds: MessageKind[] = [];
  outcome: InteractionOutcome = "ok";
  readonly meta: InteractionMeta;

  constructor(handler: string, ctx: Context, meta: InteractionMeta = {}) {
    this.handler = handler;
    this.chatKind = chatKindFromContext(ctx);
    this.userId = ctx.from?.id;
    this.chatId = ctx.chat?.id;
    this.meta = meta;
  }

  noteMessageKind(kind: MessageKind): void {
    this.messageKinds.push(kind);
  }

  flush(): void {
    if (this.outcome === "skipped" && this.messageKinds.length === 0) {
      return;
    }

    logBotInteraction({
      handler: this.handler,
      chatKind: this.chatKind,
      userId: this.userId,
      chatId: this.chatId,
      messageKinds: this.messageKinds,
      outcome: this.outcome,
      meta: Object.keys(this.meta).length ? this.meta : undefined
    });
  }
}

async function replyToUser(ctx: Context, interaction: BotInteraction, reply: BotReply): Promise<void> {
  interaction.noteMessageKind(replyMessageKind(reply));

  if (typeof reply === "string") {
    await ctx.reply(reply);
    return;
  }

  await ctx.reply(reply.text, { parse_mode: reply.parse_mode });
}

async function answerCallback(
  ctx: Context,
  interaction: BotInteraction,
  text: string,
  options?: { show_alert?: boolean }
): Promise<void> {
  interaction.noteMessageKind(options?.show_alert ? "callback_alert" : "callback_toast");
  await ctx.answerCbQuery(text, options);
}

export {
  BotInteraction,
  answerCallback,
  chatKindFromContext,
  logBotInteraction,
  replyMessageKind,
  replyToUser,
  type ChatKind,
  type InteractionOutcome,
  type MessageKind
};
