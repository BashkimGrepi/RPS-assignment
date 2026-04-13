/**
 * Live SSE Stream Module
 *
 * Establishes a persistent Server-Sent Events connection to the legacy API's /live endpoint.
 * Receives real-time match and broadcasts it to the connected client.
 */

import { env } from "../config/env.js";
import {
  INITIAL_RECONNECT_DELAY,
  MAX_RECONNECT_DELAY,
  BACKOFF_MULTIPLIER,
} from "../config/constants.js";
import { EventSource } from "eventsource";
import { transformLegacyMatch } from "../transformers/matchTransformer.js";
import { SyncSource } from "../../generated/prisma/enums.js";
import { LegacyGame } from "../types/rps-dto.js";
import { broadcast } from "../services/live.service.js";
import { IMMEDIATE_DISCONNECT_THRESHOLD, COOLDOWN_DURATION, IMMEDIATE_FAILURE_LIMIT } from "../config/constants.js";
import { legacyGameSchema } from "../utils/Zvalidation.js";
import { transform } from "zod";


let eventSource: EventSource | null = null;
let currentReconnectDelay = INITIAL_RECONNECT_DELAY;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isConnecting = false;
let shouldMaintainConnection = false;
let failureCount: number = 0;
let inCooldown = false;
let lastConnectionOpenTime: number | null = null;
let cooldownTimeout: NodeJS.Timeout | null = null;

// Process the incoming SSE event -> match data
async function processLiveEvent(eventData: string): Promise<boolean> {
  try {

    let legacyGame: LegacyGame;
    try {
      legacyGame = JSON.parse(eventData);  
    } catch (parseError) {
      console.error("Error processing live event:", parseError);
      console.error("Event data:", eventData);
      return false
    }

    const validation = legacyGameSchema.safeParse(legacyGame);
    if (!validation.success) {
      console.warn("event failed validaton",
        JSON.stringify(validation.error.issues[0])
      )
      return false;
    }

    const validGame = validation.data;
    let transformed;
    try {
      transformed = transformLegacyMatch(validGame, SyncSource.LIVE_SSE);
    } catch (transformError) {
      console.error("Error transforming live event data:", transformError);
      return false;
    }

    
    broadcast(transformed); // Broadcast to SSE clients
    return true;
  } catch (error) {
    console.error("Unexpected error processing live event:", error);
    return false;
  }
}

/**
 * Attempt to reconnect with exponential backoff
 */
function enterCooldownMode(): void {
  if (cooldownTimeout) {
    clearTimeout(cooldownTimeout);
  }

  console.log("Entering cooldown mode for 20 minutes...");

  cooldownTimeout = setTimeout(() => {
    console.log("Cooldown expired, attempting to reconnect...");
    inCooldown = false;
    failureCount = 0;
    cooldownTimeout = null;
    scheduleReconnect();
  }, COOLDOWN_DURATION);
}

function scheduleReconnect(): void {
  if (inCooldown) {
    console.log("In cooldown mode, skipping reconnection attempt");
    return;
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  if (!shouldMaintainConnection) {
    console.log(
      "Reconnection cancelled - maintaining connection flag is false",
    );
    return;
  }

  console.log(`Reconnecting in ${currentReconnectDelay / 1000}s...`);

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connectToLiveStream();

    // Increase backoff for next reconnection (exponential)
    currentReconnectDelay = Math.min(
      currentReconnectDelay * BACKOFF_MULTIPLIER,
      MAX_RECONNECT_DELAY,
    );
  }, currentReconnectDelay);
}

/**
 * Connect to the live SSE stream
 */
export function connectToLiveStream(): void {
  shouldMaintainConnection = true;

  if (isConnecting) {
    console.log("Already attempting to connect to live stream");
    return;
  }

  if (eventSource && eventSource.readyState === EventSource.OPEN) {
    console.log("Live stream already connected");
    return;
  }

  isConnecting = true;
  console.log("Connecting to live SSE stream...");

  // Create EventSource with authorization header
  eventSource = new EventSource(env.SSE_URL, {
    fetch: (url: any, init: any) => {
      return fetch(url, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          Authorization: `Bearer ${env.BEARER_TOKEN}`,
        },
      });
    },
  } as any);

  // Connection opened
  eventSource.onopen = () => {
    console.log("Live SSE stream connected!");
    isConnecting = false;
    lastConnectionOpenTime = Date.now();

    // Reset reconnection delay on successful connection
    currentReconnectDelay = INITIAL_RECONNECT_DELAY;
  };

  // Receive message/event
  eventSource.onmessage = (event: MessageEvent) => {
    if (!event.data) return;

    processLiveEvent(event.data);
  };

  // Connection error
  eventSource.onerror = (error: unknown) => {
    isConnecting = false;

    if (!shouldMaintainConnection) {
      console.log("SSE closed (intentional)");
      return;
    }

    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    // Check if disconnect was immediate (within threshold)
    const wasImmediate =
      lastConnectionOpenTime &&
      Date.now() - lastConnectionOpenTime < IMMEDIATE_DISCONNECT_THRESHOLD;

    if (wasImmediate) {
      failureCount++;
      console.warn(
        `Immediate disconnect detected (${failureCount}/${IMMEDIATE_FAILURE_LIMIT})`,
      );
      
      // If 3 consecutive immediate failures, enter cooldown
      if (failureCount >= IMMEDIATE_FAILURE_LIMIT) {
        console.error(
          "SSE cooldown detected - entering 20-minute cooldown mode",
        );
        inCooldown = true;
        enterCooldownMode();
        return;
      }
    } else {
      // Successful connection followed by normal error, reset counter
      failureCount = 0;
    }

    lastConnectionOpenTime = null;
    console.log("SSE disconnected, reconnecting...", error);
    scheduleReconnect();
  };
}

/**
 * Disconnect from the live SSE stream
 */
export function disconnectFromLiveStream(): void {
  console.log("Disconnecting from live SSE stream...");
  shouldMaintainConnection = false;

  // Clear reconnection timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  // Clear cooldown timeout
  if (cooldownTimeout) {
    clearTimeout(cooldownTimeout);
    cooldownTimeout = null;
  }

  // Close EventSource connection
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  isConnecting = false;
  inCooldown = false;
  failureCount = 0;
  currentReconnectDelay = INITIAL_RECONNECT_DELAY;

  console.log("Disconnected from live SSE stream");
}

/**
 * Get current SSE connection status
 */
export function getSseConnectionStatus(): {
  connected: boolean;
  readyState: number | null;
} {
  return {
    connected: eventSource?.readyState === EventSource.OPEN,
    readyState: eventSource?.readyState ?? null,
  };
}
