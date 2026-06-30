# Мини-CRM преподавателя вокала

MVP для преподавателя/репетитора: ученики, индивидуальные и групповые занятия, пакетные оплаты, баланс в занятиях, долги и Telegram-напоминания с кнопками `Буду` / `Не буду`.

## Стек

- Next.js + React + TypeScript
- `frontend` - Next.js web app
- `backend` - HTTP API и PostgreSQL через Drizzle ORM
- `bot` - Telegram polling service
- `reminder` - scheduler и ручные payment reminders
- `shared` - общие TypeScript-типы
- PostgreSQL + Drizzle ORM
- Telegraf для Telegram-бота

## Быстрый старт

```bash
bun install
cp .env.example .env
docker compose up -d postgres
bun run db:push
bun run seed
bun run dev:all
```

После запуска кабинет будет доступен на `http://localhost:3000`.

PostgreSQL по умолчанию: `postgres://crm:crm@localhost:5432/crm`.

Если у вас есть старый `backend/data/db.json`, импортируйте его:

```bash
bun run db:push
bun run migrate:json
```

Для запуска отдельных процессов:

```bash
bun run dev:backend
bun run dev:frontend
bun run dev:bot
bun run dev:reminder
```

Для production-сборки:

```bash
bun run build
bun run start:backend
bun start
bun run start:bot
bun run start:reminder
```

Контейнерный запуск:

```bash
docker compose up --build
```

### Логи (Loki + Grafana)

#### Локальная разработка (`bun dev:all`)

Alloy собирает логи только из Docker-контейнеров, поэтому для local dev логи отправляются в Loki напрямую из `bot` и `reminder`:

```bash
bun run observability:up
```

Добавьте в `.env`:

```bash
LOKI_PUSH_URL=http://127.0.0.1:3100/loki/api/v1/push
```

Перезапустите `bun dev:all`. Grafana: http://localhost:3030

#### Docker (production / полный стек)

Alloy автоматически собирает stdout из контейнеров CRM:

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

- **Grafana:** http://localhost:3030 (логин `admin`, пароль из `GRAFANA_ADMIN_PASSWORD`)
- **Dashboard:** CRM → CRM Logs

Примеры LogQL:

```logql
{service="bot"} | json | level="error"
{service="reminder"} | json | msg=~"backend unreachable"
{service="bot"} | json | handler=~"command:.*"
```

Логи `bot` и `reminder` — JSON. `backend` при local dev пока только в терминале (plain text).

### Sentry (ошибки и логи)

Дополнительно к Loki/Grafana можно отправлять ошибки и warn/error-логи в [Sentry](https://sentry.io):

```bash
NEXT_PUBLIC_SENTRY_DSN=https://...@....ingest.sentry.io/...
SENTRY_DSN=https://...@....ingest.sentry.io/...
SENTRY_AUTH_TOKEN=...   # для upload source maps при next build
```

- **Next.js** — client/server/edge через `@sentry/nextjs` (ошибки, tracing, session replay, logs)
- **backend / bot / reminder** — через `@sentry/node` + shared logger (warn/error)

Tunnel route `/monitoring` обходит ad-blockers в браузере.

Telegram-бот опционален. Если `TELEGRAM_BOT_TOKEN` не задан, web app работает, а Telegram service не запускает polling.

## Google Calendar

Односторонняя синхронизация CRM → Google Calendar: запланированные занятия создаются и обновляются в календаре, отменённые и завершённые — удаляются.

1. В [Google Cloud Console](https://console.cloud.google.com/) включите **Google Calendar API** для того же OAuth-клиента, что используется для входа (`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`).
2. Добавьте redirect URI: `{APP_BASE_URL}/api/google-calendar/callback` (для локальной разработки: `http://localhost:3000/api/google-calendar/callback`).
3. В настройках CRM нажмите **Подключить Google Calendar**, затем включите синхронизацию.

Опционально задайте часовой пояс событий: `APP_TIMEZONE=Europe/Minsk`.

## Telegram

1. Создайте бота через BotFather.
2. Укажите токен в `.env`:

```bash
TELEGRAM_BOT_TOKEN=123456:token
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=VocalLessonBot
```

3. Запустите web app и bot service.
4. В карточке ученика скопируйте ссылку подключения Telegram и отправьте ученику.
5. Ученик открывает ссылку, бот получает `/start <token>` и сам привязывает `chat id` к ученику.

Напоминания о занятиях отправляются по `LESSON_REMINDER_MINUTES`, например `1440,120` означает за 24 часа и за 2 часа.

## Что реализовано

- Карточки учеников: ФИО, Telegram username/link token, статус, цена разового занятия.
- Расписание: индивидуальные и групповые занятия, разные длительности, статусы занятий и участников.
- Групповой сценарий: если в групповом занятии остается один подтвержденный ученик, занятие автоматически считается индивидуальным.
- Оплаты: разовая оплата или пакет на целое число занятий, например 4 или 8.
- Баланс: оплачено, использовано, осталось, долг в занятиях.
- Долги: долг одного ученика не влияет на остальных участников группового занятия.
- Telegram-кнопки: `Буду` подтверждает участие, `Не буду` отмечает отказ.
- Напоминания об оплате: ручная отправка из таблицы учеников при долге или нулевом балансе занятий.

## Основные API

- `GET /api/snapshot` - все данные для интерфейса.
- `GET /api/dashboard` - ближайшие занятия, должники и счетчики.
- `POST /api/students` - создать ученика.
- `PATCH /api/students/:id` - обновить ученика.
- `POST /api/lesson-packages` - создать пакет занятий.
- `POST /api/lessons` - создать занятие.
- `POST /api/lessons/:id/participants/:studentId/status` - изменить статус участия.
- `POST /api/lessons/:id/complete` - провести занятие и списать занятия с балансов.
- `POST /api/lessons/:id/cancel` - отменить занятие преподавателем.
- `POST /api/payments` - внести оплату.
- `POST /api/balance-adjustments` - вручную скорректировать баланс.
- `POST /api/payment-reminders/:studentId` - отправить напоминание об оплате.

## Ограничения MVP

- Все занятия считаются офлайн и в одном локальном времени преподавателя.
- Все ученики считаются совершеннолетними.
- Нет заметок, комментариев, топов и статистики дохода.
- Повторяющиеся занятия создаются как серия обычных еженедельных занятий.
