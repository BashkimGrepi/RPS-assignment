import { env } from "../config/env.js";
import { HttpGet } from "../lib/client.js";
// calls to legacy api with token in header


if (!env.BEARER_TOKEN) throw new Error("BEARER_TOKEN is not set");

export async function fetchWithToken<T>(url: string): Promise<T>  {
  return HttpGet<T>(url, {
    Authorization: `Bearer ${env.BEARER_TOKEN}`,
    Accept: "application/json",
  })
} 

