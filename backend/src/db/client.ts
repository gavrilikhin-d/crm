import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function resolveConnectionString(): string {
  return (
    process.env.DATABASE_URL ??
    process.env.TEST_DATABASE_URL ??
    "postgres://crm:crm@localhost:5432/crm"
  );
}

let client: ReturnType<typeof postgres> | undefined;
let database: PostgresJsDatabase<typeof schema> | undefined;

function getClient(): ReturnType<typeof postgres> {
  if (!client) {
    client = postgres(resolveConnectionString(), { max: 10 });
  }

  return client;
}

function getDb(): PostgresJsDatabase<typeof schema> {
  if (!database) {
    database = drizzle(getClient(), { schema });
  }

  return database;
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  }
});

export type Db = typeof db;
