#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const questionsDir = path.join(scriptDir, "questions");

const baseUrl = process.env.METABASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
const adminEmail = process.env.METABASE_ADMIN_EMAIL;
const adminPassword = process.env.METABASE_ADMIN_PASSWORD;
const crmDatabaseUrl = process.env.METABASE_CRM_DATABASE_URL;
const siteName = process.env.METABASE_SITE_NAME ?? "CRM Platform Analytics";

if (!adminEmail || !adminPassword) {
  console.error("METABASE_ADMIN_EMAIL and METABASE_ADMIN_PASSWORD are required");
  process.exit(1);
}

if (!crmDatabaseUrl) {
  console.error("METABASE_CRM_DATABASE_URL is required");
  process.exit(1);
}

async function request(method, route, body, sessionId) {
  const headers = { "Content-Type": "application/json" };
  if (sessionId) {
    headers["X-Metabase-Session"] = sessionId;
  }

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new Error(`${method} ${route} failed (${response.status}): ${typeof payload === "string" ? payload : JSON.stringify(payload)}`);
  }

  return payload;
}

async function waitForHealth(timeoutMs = 300_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const health = await request("GET", "/api/health");
      if (health?.status === "ok") {
        return;
      }
    } catch {
      // Metabase still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Metabase did not become healthy within ${timeoutMs}ms`);
}

function parseDatabaseUrl(urlString) {
  const url = new URL(urlString);
  const details = {
    host: url.hostname,
    port: Number(url.port || 5432),
    dbname: url.pathname.replace(/^\//, ""),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: url.searchParams.get("sslmode") === "require",
    "schema-filters-type": "inclusion",
    "schema-filters-patterns": "analytics"
  };

  const options = url.searchParams.get("options");
  if (options) {
    details.options = options;
  }

  return details;
}

async function ensureSetup() {
  const properties = await request("GET", "/api/session/properties");
  if (!properties["setup-token"]) {
    return;
  }

  await request("POST", "/api/setup", {
    token: properties["setup-token"],
    prefs: { site_name: siteName },
    user: {
      email: adminEmail,
      password: adminPassword,
      first_name: "Platform",
      last_name: "Admin",
      site_name: siteName
    },
    database: {
      engine: "postgres",
      name: "CRM",
      details: parseDatabaseUrl(crmDatabaseUrl)
    }
  });
}

async function login() {
  const session = await request("POST", "/api/session", {
    username: adminEmail,
    password: adminPassword
  });
  return session.id;
}

async function ensureDatabase(sessionId) {
  const databases = await request("GET", "/api/database", null, sessionId);
  const existing = databases.data?.find((entry) => entry.name === "CRM");
  if (existing) {
    return existing.id;
  }

  const created = await request(
    "POST",
    "/api/database",
    {
      engine: "postgres",
      name: "CRM",
      details: parseDatabaseUrl(crmDatabaseUrl)
    },
    sessionId
  );
  return created.id;
}

async function loadQuestions() {
  const files = (await readdir(questionsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const questions = [];
  for (const file of files) {
    const sql = (await readFile(path.join(questionsDir, file), "utf8")).trim();
    const slug = file.replace(/^\d+_/, "").replace(/\.sql$/, "");
    const title = slug
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    questions.push({ file, title, sql });
  }
  return questions;
}

function displayForQuestion(file) {
  if (file.startsWith("01_") || file.startsWith("02_") || file.startsWith("03_") || file.startsWith("04_")) {
    return "scalar";
  }
  if (file.startsWith("05_") || file.startsWith("06_")) {
    return "pie";
  }
  if (file.startsWith("07_") || file.startsWith("08_")) {
    return "line";
  }
  return "table";
}

async function ensureQuestions(sessionId, databaseId, questionDefs) {
  const response = await request("GET", "/api/card", null, sessionId);
  const cards = Array.isArray(response) ? response : response.data ?? [];
  const byName = new Map(cards.map((card) => [card.name, card]));
  const created = [];

  for (const question of questionDefs) {
    const existing = byName.get(question.title);
    if (existing) {
      created.push(existing);
      continue;
    }

    const card = await request(
      "POST",
      "/api/card",
      {
        name: question.title,
        dataset_query: {
          type: "native",
          native: { query: question.sql },
          database: databaseId
        },
        display: displayForQuestion(question.file),
        visualization_settings: {}
      },
      sessionId
    );
    created.push(card);
  }

  return created;
}

async function ensureDashboard(sessionId, cards) {
  const dashboards = await request("GET", "/api/dashboard", null, sessionId);
  const existing = dashboards.find((dashboard) => dashboard.name === "Platform Overview");
  let dashboardId = existing?.id;

  if (!dashboardId) {
    const created = await request(
      "POST",
      "/api/dashboard",
      {
        name: "Platform Overview",
        description: "Cross-teacher CRM metrics"
      },
      sessionId
    );
    dashboardId = created.id;
  }

  const layout = [
    { cardIndex: 0, row: 0, col: 0, sizeX: 6, sizeY: 3 },
    { cardIndex: 1, row: 0, col: 6, sizeX: 6, sizeY: 3 },
    { cardIndex: 2, row: 0, col: 12, sizeX: 6, sizeY: 3 },
    { cardIndex: 3, row: 0, col: 18, sizeX: 6, sizeY: 3 },
    { cardIndex: 4, row: 3, col: 0, sizeX: 12, sizeY: 8 },
    { cardIndex: 5, row: 3, col: 12, sizeX: 12, sizeY: 8 },
    { cardIndex: 6, row: 11, col: 0, sizeX: 12, sizeY: 8 },
    { cardIndex: 7, row: 11, col: 12, sizeX: 12, sizeY: 8 },
    { cardIndex: 8, row: 19, col: 0, sizeX: 24, sizeY: 10 }
  ];

  const dashcards = layout
    .filter((slot) => cards[slot.cardIndex])
    .map((slot, index) => ({
      id: -(index + 1),
      card_id: cards[slot.cardIndex].id,
      row: slot.row,
      col: slot.col,
      size_x: slot.sizeX,
      size_y: slot.sizeY,
      parameter_mappings: [],
      visualization_settings: {}
    }));

  await request(
    "PUT",
    `/api/dashboard/${dashboardId}`,
    {
      name: "Platform Overview",
      description: "Cross-teacher CRM metrics",
      dashcards
    },
    sessionId
  );

  return dashboardId;
}

async function main() {
  console.log(`Waiting for Metabase at ${baseUrl}...`);
  await waitForHealth();
  await ensureSetup();

  const sessionId = await login();
  const databaseId = await ensureDatabase(sessionId);
  const questionDefs = await loadQuestions();
  const cards = await ensureQuestions(sessionId, databaseId, questionDefs);
  const dashboardId = await ensureDashboard(sessionId, cards);

  console.log(`Metabase bootstrap complete. Dashboard id: ${dashboardId}`);
  console.log(`${baseUrl}/dashboard/${dashboardId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
