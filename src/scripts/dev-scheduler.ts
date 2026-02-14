/**
 * Development scheduler: calls the cron endpoint every 60 seconds.
 * Run with: npm run scheduler:dev
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local since this script runs outside Next.js
function loadEnvLocal() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local not found — use defaults
  }
}
loadEnvLocal();

const CRON_SECRET = process.env.CRON_SECRET || "dev-secret";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const INTERVAL_MS = 60 * 1000;

async function tick() {
  const timestamp = new Date().toISOString();
  try {
    console.log(
      `[${timestamp}] Triggering cron: ${APP_URL}/api/cron/publish-scheduled`
    );
    const response = await fetch(`${APP_URL}/api/cron/publish-scheduled`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const result = await response.json();
    console.log(`[${timestamp}] Result:`, JSON.stringify(result));
  } catch (error) {
    console.error(`[${timestamp}] Cron tick failed:`, error);
  }
}

console.log(`Dev scheduler started (interval: ${INTERVAL_MS / 1000}s)`);
console.log(`Target: ${APP_URL}/api/cron/publish-scheduled`);
tick(); // Immediate first tick
setInterval(tick, INTERVAL_MS);
