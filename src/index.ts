import { loadEnvFile } from "node:process";
loadEnvFile("./.env"); // Load environment variables from .env file
import app from "./app.js";
import {
  startSyncSubsystem,
  setupGracefulShutdown,
} from "./sync/syncRunner.js";
import { connectToLiveStream, disconnectFromLiveStream } from "./sync/liveStream.js";


const PORT = process.env.PORT || 3000; 
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  //Start sync subsystem (non-blocking)
  // This runs in the background and doesn't block the HTTP server
  startSyncSubsystem().catch((error) => {
    console.error("❌ Failed to start sync subsystem:", error);
  });

  connectToLiveStream();
});





// Setup graceful shutdown handlers
setupGracefulShutdown();
disconnectFromLiveStream(); // Ensure SSE connection is closed on shutdown
