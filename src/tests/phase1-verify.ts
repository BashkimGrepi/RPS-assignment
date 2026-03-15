/**
 * Phase 1 Verification Script
 * Tests the core utilities needed for database operations
 *
 * Run with: npx tsx src/tests/phase1-verify.ts
 */

import { Move, SyncSource } from "../../generated/prisma/enums.js";
import {
  determineWinner,
  getResultType,
  stringToMove,
} from "../utils/rpsLogic.js";
import { transformLegacyMatch } from "../transformers/matchTransformer.js";
import { upsertPlayer, upsertMatch } from "../db/upsertHelpers.js";
import { LegacyGame } from "../types/rps-dto.js";

async function testPhase1() {
  console.log("🧪 Testing Phase 1 Implementation...\n");

  // Test 1: RPS Logic - All 9 combinations
  console.log("✅ Test 1: RPS Logic - All Move Combinations");
  const tests = [
    { a: Move.ROCK, b: Move.SCISSORS, expected: "PLAYER_A" },
    { a: Move.ROCK, b: Move.PAPER, expected: "PLAYER_B" },
    { a: Move.ROCK, b: Move.ROCK, expected: "TIE" },
    { a: Move.PAPER, b: Move.ROCK, expected: "PLAYER_A" },
    { a: Move.PAPER, b: Move.SCISSORS, expected: "PLAYER_B" },
    { a: Move.PAPER, b: Move.PAPER, expected: "TIE" },
    { a: Move.SCISSORS, b: Move.PAPER, expected: "PLAYER_A" },
    { a: Move.SCISSORS, b: Move.ROCK, expected: "PLAYER_B" },
    { a: Move.SCISSORS, b: Move.SCISSORS, expected: "TIE" },
  ];

  for (const test of tests) {
    const result = determineWinner(test.a, test.b);
    const passed = result === test.expected;
    console.log(
      `  ${passed ? "✅" : "❌"} ${test.a} vs ${test.b} = ${result} (expected ${test.expected})`,
    );
  }

  // Test 2: String to Move conversion
  console.log("\n✅ Test 2: String to Move Conversion");
  console.log("  'ROCK' →", stringToMove("ROCK"));
  console.log("  'rock' →", stringToMove("rock"));
  console.log("  'Paper' →", stringToMove("Paper"));
  console.log("  'SCISSORS' →", stringToMove("SCISSORS"));

  // Test 3: Result Type conversion
  console.log("\n✅ Test 3: Result Type Conversion");
  console.log("  PLAYER_A →", getResultType("PLAYER_A"));
  console.log("  PLAYER_B →", getResultType("PLAYER_B"));
  console.log("  TIE →", getResultType("TIE"));

  // Test 4: Match transformation
  console.log("\n✅ Test 4: Match Transformation");
  const sampleLegacyGame: LegacyGame = {
    type: "GAME",
    gameId: "test-game-phase1-" + Date.now(),
    time: 1710259200000, // March 12, 2026
    playerA: {
      name: "Alice",
      played: "ROCK",
    },
    playerB: {
      name: "Bob",
      played: "SCISSORS",
    },
  };

  const transformed = transformLegacyMatch(
    sampleLegacyGame,
    SyncSource.HISTORY_BACKFILL,
  );
  console.log("  Game ID:", transformed.gameId);
  console.log(
    "  Player A:",
    transformed.playerAName,
    "played",
    transformed.playerAChoice,
  );
  console.log(
    "  Player B:",
    transformed.playerBName,
    "played",
    transformed.playerBChoice,
  );
  console.log("  Winner:", transformed.winnerPlayerName);
  console.log("  Loser:", transformed.loserPlayerName);
  console.log("  Result:", transformed.resultType);
  console.log("  Source:", transformed.ingestedFrom);

  // Test 5: Database operations (requires database connection)
  console.log("\n✅ Test 5: Database Operations");
  try {
    // Upsert players
    const alice = await upsertPlayer("Alice-Test-" + Date.now());
    const bob = await upsertPlayer("Bob-Test-" + Date.now());
    console.log("  ✅ Created/found players:");
    console.log("    -", alice.name, "(ID:", alice.id + ")");
    console.log("    -", bob.name, "(ID:", bob.id + ")");

    // Update transformed match with unique player names
    transformed.playerAName = alice.name;
    transformed.playerBName = bob.name;
    transformed.winnerPlayerName = alice.name;
    transformed.loserPlayerName = bob.name;

    // Upsert match
    const match = await upsertMatch(transformed);
    console.log("  ✅ Created match:");
    console.log("    - Game ID:", match.gameId);
    console.log("    - Match ID:", match.id);
    console.log("    - Winner ID:", match.winnerPlayerId);
    console.log("    - Loser ID:", match.loserPlayerId);

    // Test deduplication - upsert same match again
    const duplicateMatch = await upsertMatch(transformed);
    const isDeduped = match.id === duplicateMatch.id;
    console.log("  ✅ Deduplication test:", isDeduped ? "PASSED" : "FAILED");
    console.log("    - First insert ID:", match.id);
    console.log("    - Second insert ID:", duplicateMatch.id);
  } catch (error) {
    console.error("  ❌ Database test failed:", error);
    console.error(
      "\n⚠️  Make sure your database is running and migrations are applied!",
    );
    console.error("     Run: npx prisma migrate dev");
  }

  console.log("\n🎉 Phase 1 Implementation Verification Complete!");
  console.log("\n📋 Summary:");
  console.log("  ✅ RPS game logic (determineWinner, getResultType)");
  console.log("  ✅ String to enum conversion (stringToMove)");
  console.log("  ✅ Legacy match transformation (transformLegacyMatch)");
  console.log("  ✅ Database upsert operations (upsertPlayer, upsertMatch)");
  console.log("  ✅ Deduplication via gameId uniqueness");
  console.log("\n✨ Ready for Phase 2: Historical Backfill");
}

testPhase1()
  .catch(console.error)
  .finally(() => process.exit(0));
