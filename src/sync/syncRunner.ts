/**
 * Sync Subsystem Runner
 *
 * Orchestrates all three data ingestion mechanisms:
 * 1. Historical Backfill - Progressive import of historical data
 * 3. Periodic Reconciliation - Gap-filling every 10 minutes
 *
 * Provides unified start/stop controls and graceful shutdown handling.
 */

import {
  startBackfillOrchestrator,
  stopBackfillOrchestrator,
  getBackfillStatus,
} from "./backfillOrchestrator.js";
import { env } from "../config/env.js";
import {
  startReconciliationScheduler,
  stopReconciliationScheduler,
  getReconciliationStatus,
} from "./reconciliationScheduler.js";
import { prisma } from "../lib/prisma.js";
import { connectToLiveStream, disconnectFromLiveStream, getSseConnectionStatus } from "./liveStream.js";


let isSubsystemRunning = false;


async function ensureSyncState(): Promise<void> {
  await prisma.syncState.upsert({
    where: { key: env.SYNC_STATE_KEY },
    update: {}, // Don't overwrite existing state
    create: {
      key: env.SYNC_STATE_KEY,
      backfillCursor: null,
      backfillCompleted: false,
      isBackfillRunning: false,
      sseConnected: false,
    },
  });
}

/**
 * Start all sync subsystem processes
 *
 * This function orchestrates:
 * - Historical backfill (runs until complete)
 * - Periodic reconciliation (runs every 10 minutes)
 * - Live SSE stream connection (runs continuously)
 *
 * It ensures that all components are started in the correct order and handles any initialization logic.
 * If any component fails to start, it attempts to clean up and throws an error.
 */
export async function startSyncSubsystem(): Promise<void> {
  if (isSubsystemRunning) {
    console.log("Sync subsystem already running");
    return;
  }


  try {
    await ensureSyncState();
    console.log("Sync state initialized");

    // Start all three sync mechanisms
    await startBackfillOrchestrator();
    console.log("backfill orchestrator started");

    connectToLiveStream();
    console.log("Connected to live SSE stream");

    startReconciliationScheduler();
    console.log("periodic reconciliation scheduler started");

    isSubsystemRunning = true;

    await prisma.syncState.update({
      where: { key: env.SYNC_STATE_KEY },
      data: {
        sseConnected: true,
        isBackfillRunning: true,
        isReconcileRunning: true,
      }
    })
  } catch (error) {
    console.error(" Failed to start sync subsystem:", error);
    // Attempt cleanup on failure
    await stopSyncSubsystem();
    throw error;
  }
}

// graceful shutdonwn
async function stopSyncSubsystem(): Promise<void> {

  const teardownError: unknown[] = [];

  
  try {
    stopBackfillOrchestrator();
    console.log("historical backfill orchestrator stopped");
  } catch (error) {
    console.error("Error during sync subsystem shutdown:", error);
    teardownError.push(error);
  }

  try {
    disconnectFromLiveStream();
    console.log("Connected to live SSE stream disconnected");
  } catch (error) {
    console.error("Error during live SSE stream disconnection:", error);
    teardownError.push(error);
  }

  try {
    stopReconciliationScheduler();
    console.log("periodic reconciliation scheduler stopped");
  } catch (error) {
    console.error("Error during periodic reconciliation scheduler shutdown:", error);
    teardownError.push(error);
  }
  isSubsystemRunning = false;
  console.log("SYNC SUBSYSTEM STOPPED");


  try {
    await prisma.syncState.upsert({
      where: { key: env.SYNC_STATE_KEY },
      update: {
        sseConnected: false,
        isBackfillRunning: false,
        isReconcileRunning: false,
      },
      create: {
        key: env.SYNC_STATE_KEY,
        backfillCursor: null,
        isBackfillRunning: false,
        isReconcileRunning: false,
        sseConnected: false
      },
    });
  } catch (error) {
    console.error("Error updating sync state during shutdown:", error);
    // even if updating the db fails log the error and continue with shutdown
  }
}


export async function getSyncSubsystemStatus(): Promise<{
  subsystemRunning: boolean;
  backfill: {
    completed: boolean;
    isRunning: boolean;
    cursor: string | null;
    lastRun: Date | null;
  };
  sseStream: {
  connected: boolean;
  readyState: number | null;
  };
  reconciliation: {
    isSchedulerActive: boolean;
    isCurrentlyRunning: boolean;
  };
  database: {
    totalMatches: number;
    latestKnownMatch: {
      time: Date | null;
      gameId: string | null;
    };
  };
}> {

  const backfillStatus = await getBackfillStatus();
  const sseStatus = getSseConnectionStatus();
  const reconciliationStatus = getReconciliationStatus();

  // Get database statistics
  const totalMatches = await prisma.match.count();
  const syncState = await prisma.syncState.findUnique({
    where: { key: env.SYNC_STATE_KEY },
  });

  return {
    subsystemRunning: isSubsystemRunning,
    backfill: backfillStatus,
    sseStream: sseStatus,
    reconciliation: reconciliationStatus,
    database: {
      totalMatches,
      latestKnownMatch: {
        time: syncState?.latestKnownMatchTime || null,
        gameId: syncState?.latestKnownGameId || null,
      },
    },
  };
}


export function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    console.log(`${signal} received - initiating graceful shutdown`);

    try {
      await stopSyncSubsystem();
      await prisma.$disconnect();
      console.log("Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  // Handle various termination signals
  process.on("SIGINT", () => shutdown("SIGINT (Ctrl+C)"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGUSR2", () => shutdown("SIGUSR2 (nodemon restart)")); // For nodemon

  // Handle uncaught errors
  process.on("uncaughtException", async (error) => {
    console.error("Uncaught Exception:", error);
    await shutdown("uncaughtException");
  });

  process.on("unhandledRejection", async (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    await shutdown("unhandledRejection");
  });
}
