import { Response } from "express";
import { LegacyGame, NormalizedGame } from "../types/rps-dto.js";
import { TransformedMatch } from "../types/transformedMatch.js";


const connectedClients = new Set<Response>();


// Register a new sse client connection
export function addClient(res: Response): void {
    connectedClients.add(res);
    console.log(`client connected. total clients = ${connectedClients.size}`);
}

// unregister a client connection 
export function removeClient(res: Response): void {
    connectedClients.delete(res);
}

// Broadcast a game update to all connected clients
export function broadcast(match: TransformedMatch): void {
    if (connectedClients.size === 0) {
        console.log("no cliients connected")
        return;
    }

    console.log(`broadcasting update to ${connectedClients.size} clients:`, match);

    const data = JSON.stringify(match);
    const deadClients: Response[] = [];

    connectedClients.forEach((client) => {
        try {
            // send SSE message
            client.write(`data: ${data}\n\n`);
        } catch (error: any) {
            deadClients.push(client);
        }
    });

    // Clean up dead clients
    deadClients.forEach((client) => removeClient(client));
}





