import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

// #region agent log
(function () {
  const u = process.env.POSTGRES_URL ?? "";
  const portMatch = u.match(/:(\d+)\//);
  const port = portMatch ? portMatch[1] : "none";
  fetch("http://127.0.0.1:7419/ingest/98591116-26ca-4951-84cc-978201ab08af", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2e5fad" },
    body: JSON.stringify({
      sessionId: "2e5fad",
      location: "packages/db/src/client.ts:moduleLoad",
      message: "POSTGRES_URL descriptor at db client load",
      data: { port, hasPooler: u.includes("pooler"), len: u.length, hasPostgresUrlNonPooled: "POSTGRES_URL_NON_POOLED" in process.env },
      timestamp: Date.now(),
      hypothesisId: "A",
    }),
  }).catch(() => {});
})();
// #endregion

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 10,
});

export const db = drizzle({
  client: pool,
  schema,
  casing: "snake_case",
});
