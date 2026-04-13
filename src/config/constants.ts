// constant values here for the project

// Cache settings
export const CACHE_REFRESH_INTERVAL = 15_000; // 15 seconds
export const CACHE_REFRESH_INTERVAL_FOR_DAY_CACHE = 240_000; // 4 minutes, since day-based data is less likely to change frequently
    

// Reconnection backoff settings
export const INITIAL_RECONNECT_DELAY = 1000; // 1 second
export const MAX_RECONNECT_DELAY = 30000; // 30 seconds
export const BACKOFF_MULTIPLIER = 2;


// reconciliation settings
export const MAX_RECONCILIATION_PAGES = 6; 

// backfill settings
export const CATCHING_UP_INTERVAL_MS = 5 * 1000; // 5 seconds - while catching up
export const DELAY_BETWEEN_PAGES_MS = 100; // Rate limiting to avoid overwhelming API


// SSE connection settings
export const IMMEDIATE_DISCONNECT_THRESHOLD = 5000; // 5 seconds
export const COOLDOWN_DURATION = 20 * 60 * 1000; // 20 minutes
export const IMMEDIATE_FAILURE_LIMIT = 3;



