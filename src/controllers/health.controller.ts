import { Request, Response } from "express";
import { getSyncSubsystemStatus } from "../sync/syncRunner.js";
import { prisma } from "../lib/prisma.js";

/**
 * GET /health
 * Returns comprehensive system health and status information
 */
export async function getHealthStatus(req: Request, res: Response) {
  try {
    // Check database connection
    let dbConnected = false;
    let dbError = null;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch (error: any) {
      dbError = error.message;
    }

    // Get sync subsystem status
    const syncStatus = await getSyncSubsystemStatus();

    // Calculate overall health
    const isHealthy =
      dbConnected &&
      syncStatus.subsystemRunning &&
      (syncStatus.backfill.completed || syncStatus.backfill.isRunning);

    const response = {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        error: dbError,
        totalMatches: syncStatus.database.totalMatches,
      },
      syncSubsystem: {
        running: syncStatus.subsystemRunning,
        backfill: {
          completed: syncStatus.backfill.completed,
          isRunning: syncStatus.backfill.isRunning,
          cursor: syncStatus.backfill.cursor,
          lastRun: syncStatus.backfill.lastRun?.toISOString() || null,
        },
        //sseStream: {
          //connected: syncStatus.sseStream.connected,
          //readyState: syncStatus.sseStream.readyState,
        //},
        reconciliation: {
          schedulerActive: syncStatus.reconciliation.isSchedulerActive,
          currentlyRunning: syncStatus.reconciliation.isCurrentlyRunning,
        },
        latestKnownMatch: {
          time:
            syncStatus.database.latestKnownMatch.time?.toISOString() || null,
          gameId: syncStatus.database.latestKnownMatch.gameId,
        },
      },
    };

    // Return 200 if healthy, 503 if degraded
    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (error) {
    console.error("Error fetching health status:", error);
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: "Unable to determine system health",
    });
  }
}
