import { Response } from "express";
import { TransformedMatch } from "../types/rps-dto.js";


const connectedClients = new Set<Response>();

function validateBroadcastData(match: TransformedMatch): boolean {
  try {
    if (!match.gameId || typeof match.gameId !== "string") {
      console.error("Invalid gameId in broadcast data");
      return false;
    }
    if (!match.playedAt || !(match.playedAt instanceof Date)) {
      console.error("Invalid playedAt in broadcast data");
      return false;
      }

    return true;
  } catch (error) {
    console.error("Broadcast validation error:", error);
    return false;
  }
}

function formatSSEMessage(match: TransformedMatch): string {
  const data = JSON.stringify(match);
  return `data: ${data}\n\n`;
}

// Register a new sse client connection
 export function addClient(res: Response): void {
    connectedClients.add(res);
    console.log(`client connected. total clients = ${connectedClients.size}`);

    // listens for client disconnect
    const onClose = () => {
        console.log("client disconnected");
        removeClient(res);
     };
     
     // remove client on error
     const onError = (err: Error) => {
         removeClient(res);
         console.error("Error with client connection:", err);
     }

     res.once("close", onClose);
     res.once("error", onError);
}

// unregister a client connection 
export function removeClient(res: Response): void {
    if (!connectedClients.has(res)) return;

    connectedClients.delete(res);
    console.log("client removed. total clients = ", connectedClients.size);

    // for memory leak prevention, clean up event listeners
    const cleanup = () => {
        res.removeListener("close", cleanup);
        res.removeListener("error", cleanup);
    }
    
}

// Broadcast a game update to all connected clients
export function broadcast(match: TransformedMatch): void {

    if (!validateBroadcastData(match)) {
        console.error("Broadcast data failed validation, not sending update");
        return;
    }

    if (connectedClients.size === 0) {
        console.log("no cliients connected")
        return;
    }

    console.log(`broadcasting update to ${connectedClients.size} clients:`, match);

    const deadClients: Response[] = [];
    const failedClients: { client: Response; reason: string }[] = [];

    const message = formatSSEMessage(match);

    connectedClients.forEach((client) => {
        try {
            if (!client.writable) {
                console.warn("client not writable, removing");
                deadClients.push(client);
                return;
            }

            //write returns false if the buffer is full
            const flushed = client.write(message);
            if (!flushed) {
                console.warn("client buffer full, (slow) client)");
                // this will not be removed
                // will have to come up with a strategy to handle slow clients
            }

        } catch (error: any) {
            const errorMsg = error?.message || "unknown error";
            console.error("Failed to send to client: ", errorMsg);

            failedClients.push({ client, reason: errorMsg });
            deadClients.push(client);
        } 
    });
    // Clean up dead clients
    if (deadClients.length > 0) {
        deadClients.forEach((client) => removeClient(client));
    }

    const successCount = connectedClients.size;
    console.log("broadcast complete. success: ", successCount, "failed: ", failedClients.length);
}





