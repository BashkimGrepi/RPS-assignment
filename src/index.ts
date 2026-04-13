import { env } from "./config/env.js";
import app from "./app.js";
import {
  startSyncSubsystem,
  setupGracefulShutdown,
} from "./sync/syncRunner.js";


app.listen(env.PORT, () => {
  // This runs in the background and doesn't block the HTTP server
  startSyncSubsystem().catch((error) => {
    console.error("Failed to start sync subsystem:", error);
  });

});

// graceful shutdown handler
setupGracefulShutdown();
