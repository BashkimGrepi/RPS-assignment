import { loadEnvFile } from "node:process";
loadEnvFile("./.env"); // Load environment variables from .env file

function requiredEnvVar(name: string, value: string): string {

    if (!value) {
        throw new Error(`Environment variable ${name} is required but not set.`);
    }
    return value;
}

function toNumber(name: string, value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        throw new Error(`Environment variable ${name} must be a valid number, but got: ${value}`);
    }
    return parsed;
}




export const env = {
  PORT: Number(requiredEnvVar("PORT", process.env.PORT || "3000")),
  DATABASE_URL: requiredEnvVar("DATABASE_URL", process.env.DATABASE_URL || ""),
  BEARER_TOKEN: requiredEnvVar("BEARER_TOKEN", process.env.BEARER_TOKEN || ""),
  LEGACY_API_BASE_URL: requiredEnvVar(
    "LEGACY_API_BASE_URL",
    process.env.LEGACY_API_BASE_URL || "",
  ),
  SSE_URL: requiredEnvVar("SSE_URL", process.env.SSE_URL || ""),
  HTTP_TIMEOUT_MS: toNumber(
    "HTTP_TIMEOUT_MS",
    process.env.HTTP_TIMEOUT_MS,
    5000,
  ),
  HTTP_MAX_RETRIES: toNumber(
    "HTTP_MAX_RETRIES",
    process.env.HTTP_MAX_RETRIES,
    3,
  ),
  HTTP_RETRY_BASE_DELAY_MS: toNumber(
    "HTTP_RETRY_BASE_DELAY_MS",
    process.env.HTTP_RETRY_BASE_DELAY_MS,
    500,
  ),
  SYNC_STATE_KEY: requiredEnvVar(
    "SYNC_STATE_KEY",
    process.env.SYNC_STATE_KEY || "main",
  ),
  ORIGIN: requiredEnvVar(
    "ORIGIN",
    process.env.ORIGIN || "http://localhost:5173",
  ),
};