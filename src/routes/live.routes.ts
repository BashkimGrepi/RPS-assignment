import { Request, Router, Response  } from "express";
import { addClient, removeClient } from "../services/live.service.js";
import { error } from "console";


const liveRouter = Router();

// /api/live-stream


liveRouter.get("/stream", (req: Request, res: Response) => {
    console.log("new sse client connecting ")

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Register client wiht broadcaster
    addClient(res);// this will keep the connection open and send eventt to the client

    // send initial connection message
    res.write(`:connected\n\n`);

    // Handle client disconnect
    req.on("close", () => {
        console.error("sse client error", error);
        removeClient(res);
    });
});

export default liveRouter;