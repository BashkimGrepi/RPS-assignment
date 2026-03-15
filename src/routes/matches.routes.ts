import { Router } from "express";
import { getMatchesController } from "../controllers/matches.controller.js";

const router = Router();

// GET /api/matches - Get paginated list of matches with filtering
// query params : playerName and date
// or
/// query params: playerName
// or
// query params: date
// or no query params for all matches
router.get("/", getMatchesController);


export default router;
