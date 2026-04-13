// A simple HTTP client with retry logic and exponential backoff, designed for GET requests.
// It handles network errors, timeouts, and specific HTTP status codes (like 429 Too Many Requests).
// The client is configurable via environment variables for timeout duration, max retries, and base delay for backoff.

import { env } from "../config/env.js";

type HttpMethod = "GET";

type RequestOptions = {
    method: HttpMethod;
    headers: Record<string, string>;
    body?: unknown;
    timeoutMs?: number;
    maxRetries?: number;
}

type HttpSuccess<T> = {
    data: T;
    status: number;
    headers: Headers;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateBackoffDelay(attempt: number, baseDelayMs: number): number {
    // exponential backoff: 500, 100, 2000...
    const exponential = baseDelayMs * 2 ** (attempt - 1);

    // small jitter to reduce synchronized retries
    const jitter = Math.floor(Math.random() * 150);

    return exponential + jitter;
}

function isRetryableStatus(status: number): boolean {
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function shouldRetry(attempt: number, maxRetries: number, status?: number, networkError?: unknown): boolean {
    if (attempt > maxRetries) return false;

    if (networkError) return true; // retry on network errors

    // retry on the spesicif response codes. modify this to you needs
    if (status && isRetryableStatus(status)) return true;

    return false;
}

function parseRetryAfter(headers: Headers): number | null {
    const retryAfter = headers.get("Retry-After");
    if (!retryAfter) return null;

    const seconds = Number(retryAfter);
    if (!isNaN(seconds)) {
        return seconds * 1000; // convert to ms
    }

    const dateMs = new Date(retryAfter).getTime();
    if (!Number.isNaN(dateMs)) {
        const delay = dateMs - Date.now();
        return delay > 0 ? delay : 0; 
    }
    return null;
}

export async function HttpGet<T>(
    url: string,
    headers: Record<string, string> = {},
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= env.HTTP_MAX_RETRIES + 1; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), env.HTTP_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method: "GET",
                headers,
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (response.ok) {
                return (await response.json()) as T;
            }

            if (!isRetryableStatus(response.status) || attempt > env.HTTP_MAX_RETRIES) {
                const errorText = await response.text().catch(() => "");
                throw new Error(
                    `GET ${url} failed with status ${response.status}: ${errorText}`
                );
            }

            const retryAfterMs = response.status === 429 ? parseRetryAfter(response.headers) : null;
            const delayMs = retryAfterMs ?? calculateBackoffDelay(attempt, env.HTTP_RETRY_BASE_DELAY_MS);

             console.warn(
                `[httpGet] Retryable status ${response.status} on attempt ${attempt}. Retrying in ${delayMs}ms`
            );

            await sleep(delayMs);
    
        } catch (error) {
            clearTimeout(timeout);
            lastError = error;

            if (attempt > env.HTTP_MAX_RETRIES) {
                throw error;
            }

            const delayMs = calculateBackoffDelay(attempt, env.HTTP_RETRY_BASE_DELAY_MS);

             console.warn(
               `[httpGet] Network/timeout error on attempt ${attempt}. Retrying in ${delayMs}ms`,
             );

             await sleep(delayMs);
        }
    }
    throw lastError instanceof Error ? lastError : new Error("GET request failed")
}