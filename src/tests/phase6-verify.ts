/**
 * Phase 6 Verification: HTTP API Endpoints
 *
 * Tests all REST endpoints with various scenarios:
 * 1. GET /api/matches/latest?limit=N
 * 2. GET /api/matches?date=YYYY-MM-DD
 * 3. GET /api/players
 * 4. GET /api/players/:name/matches
 * 5. GET /api/players/:name/stats
 * 6. GET /api/leaderboard/today
 * 7. GET /api/leaderboard?from=DATE&to=DATE
 * 8. GET /health
 * 9. Input validation (400 errors)
 */

import axios from "axios";

const BASE_URL = "http://localhost:3000";
const API_URL = `${BASE_URL}/api`;

// Helper to handle 400 errors
async function expectBadRequest(
  fn: () => Promise<any>,
  errorMessage?: string,
): Promise<void> {
  try {
    await fn();
    throw new Error("Expected request to fail with 400 but it succeeded");
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 400) {
      console.log(`  ✅ Got expected 400 error: ${error.response.data.error}`);
      if (errorMessage && !error.response.data.error.includes(errorMessage)) {
        throw new Error(
          `Expected error message to include "${errorMessage}" but got "${error.response.data.error}"`,
        );
      }
    } else {
      throw error;
    }
  }
}

async function testMatchesLatest() {
  console.log("\n=== Test 1: GET /api/matches/latest ===");

  // Test default limit
  const res1 = await axios.get(`${API_URL}/matches/latest`);
  console.log(`✅ Default limit: ${res1.data.count} matches returned`);

  if (!Array.isArray(res1.data.data)) {
    throw new Error("Response data should be an array");
  }

  // Test custom limit
  const res2 = await axios.get(`${API_URL}/matches/latest?limit=10`);
  console.log(`✅ Custom limit=10: ${res2.data.count} matches returned`);

  if (res2.data.count > 10) {
    throw new Error(`Expected max 10 matches but got ${res2.data.count}`);
  }

  // Test invalid limit
  await expectBadRequest(() =>
    axios.get(`${API_URL}/matches/latest?limit=abc`),
  );
  await expectBadRequest(() => axios.get(`${API_URL}/matches/latest?limit=0`));
  await expectBadRequest(() =>
    axios.get(`${API_URL}/matches/latest?limit=2000`),
  );

  console.log("✅ All latest matches tests passed");
}

async function testMatchesByDate() {
  console.log("\n=== Test 2: GET /api/matches?date=YYYY-MM-DD ===");

  // Get a valid date from latest matches
  const latestRes = await axios.get(`${API_URL}/matches/latest?limit=1`);
  if (latestRes.data.count > 0) {
    const date = latestRes.data.data[0].date;

    // Test with valid date
    const res = await axios.get(`${API_URL}/matches?date=${date}`);
    console.log(`✅ Matches for ${date}: ${res.data.count} matches`);

    if (!Array.isArray(res.data.data)) {
      throw new Error("Response data should be an array");
    }
  }

  // Test without date (should return latest)
  const res2 = await axios.get(`${API_URL}/matches`);
  console.log(`✅ Matches without date: ${res2.data.count} matches`);

  // Test invalid date format
  await expectBadRequest(() => axios.get(`${API_URL}/matches?date=2024/01/01`));
  await expectBadRequest(() => axios.get(`${API_URL}/matches?date=invalid`));

  console.log("✅ All matches by date tests passed");
}

async function testPlayers() {
  console.log("\n=== Test 3: GET /api/players ===");

  const res = await axios.get(`${API_URL}/players`);
  console.log(`✅ Total players: ${res.data.count}`);

  if (!Array.isArray(res.data.data)) {
    throw new Error("Response data should be an array");
  }

  if (res.data.count > 0) {
    const player = res.data.data[0];
    if (!player.name || typeof player.totalMatches !== "number") {
      throw new Error("Player object missing required fields");
    }
    console.log(
      `✅ Sample player: ${player.name} (${player.totalMatches} matches)`,
    );
  }

  console.log("✅ Players list test passed");
}

async function testPlayerMatches() {
  console.log("\n=== Test 4: GET /api/players/:name/matches ===");

  // Get a player first
  const playersRes = await axios.get(`${API_URL}/players`);
  if (playersRes.data.count === 0) {
    console.log("⚠️  No players in database yet, skipping player matches test");
    return;
  }

  const playerName = playersRes.data.data[0].name;

  // Test player matches
  const res = await axios.get(
    `${API_URL}/players/${encodeURIComponent(playerName)}/matches`,
  );
  console.log(`✅ Matches for ${playerName}: ${res.data.count}`);
  console.log(
    `  Stats: ${res.data.playerStats.wins}W-${res.data.playerStats.losses}L-${res.data.playerStats.ties}T`,
  );

  if (!Array.isArray(res.data.data)) {
    throw new Error("Response data should be an array");
  }

  if (!res.data.playerStats) {
    throw new Error("Missing playerStats in response");
  }

  // Test nonexistent player (should return empty array)
  const res2 = await axios.get(
    `${API_URL}/players/NonexistentPlayer12345/matches`,
  );
  console.log(`✅ Nonexistent player: ${res2.data.count} matches (expected 0)`);

  console.log("✅ Player matches test passed");
}

async function testPlayerStats() {
  console.log("\n=== Test 5: GET /api/players/:name/stats ===");

  // Get a player first
  const playersRes = await axios.get(`${API_URL}/players`);
  if (playersRes.data.count === 0) {
    console.log("⚠️  No players in database yet, skipping player stats test");
    return;
  }

  const playerName = playersRes.data.data[0].name;

  // Test player stats
  const res = await axios.get(
    `${API_URL}/players/${encodeURIComponent(playerName)}/stats`,
  );
  console.log(`✅ Stats for ${playerName}:`);
  console.log(`  Total: ${res.data.totalMatches}`);
  console.log(`  Wins: ${res.data.wins}`);
  console.log(`  Losses: ${res.data.losses}`);
  console.log(`  Ties: ${res.data.ties}`);

  if (typeof res.data.totalMatches !== "number") {
    throw new Error("Missing stats in response");
  }

  console.log("✅ Player stats test passed");
}

async function testLeaderboardToday() {
  console.log("\n=== Test 6: GET /api/leaderboard/today ===");

  const res = await axios.get(`${API_URL}/leaderboard/today`);
  console.log(`✅ Today's leaderboard: ${res.data.count} players`);

  if (!Array.isArray(res.data.data)) {
    throw new Error("Response data should be an array");
  }

  if (res.data.count > 0) {
    const topPlayer = res.data.data[0];
    console.log(
      `  Top player: ${topPlayer.playerName} (${topPlayer.wins} wins)`,
    );
  }

  console.log("✅ Today's leaderboard test passed");
}

async function testLeaderboardDateRange() {
  console.log("\n=== Test 7: GET /api/leaderboard?from=DATE&to=DATE ===");

  // Test with no params (should return today)
  const res1 = await axios.get(`${API_URL}/leaderboard`);
  console.log(
    `✅ Leaderboard without params: ${res1.data.count} players (today)`,
  );

  // Test with date range
  const fromDate = "2025-01-01";
  const toDate = "2025-12-31";
  const res2 = await axios.get(
    `${API_URL}/leaderboard?from=${fromDate}&to=${toDate}`,
  );
  console.log(
    `✅ Leaderboard from ${fromDate} to ${toDate}: ${res2.data.count} players`,
  );

  if (!Array.isArray(res2.data.data)) {
    throw new Error("Response data should be an array");
  }

  // Test invalid inputs
  await expectBadRequest(() =>
    axios.get(`${API_URL}/leaderboard?from=2025-01-01`),
  ); // missing to
  await expectBadRequest(() =>
    axios.get(`${API_URL}/leaderboard?to=2025-12-31`),
  ); // missing from
  await expectBadRequest(() =>
    axios.get(`${API_URL}/leaderboard?from=invalid&to=2025-12-31`),
  );
  await expectBadRequest(() =>
    axios.get(`${API_URL}/leaderboard?from=2025-12-31&to=2025-01-01`),
  ); // from > to

  console.log("✅ Leaderboard date range test passed");
}

async function testHealth() {
  console.log("\n=== Test 8: GET /health ===");

  const res = await axios.get(`${BASE_URL}/health`);
  console.log(`✅ Health status: ${res.data.status}`);
  console.log(`  Database connected: ${res.data.database.connected}`);
  console.log(`  Total matches: ${res.data.database.totalMatches}`);
  console.log(`  Sync subsystem running: ${res.data.syncSubsystem.running}`);
  console.log(
    `  Backfill completed: ${res.data.syncSubsystem.backfill.completed}`,
  );
  console.log(`  SSE connected: ${res.data.syncSubsystem.sseStream.connected}`);
  console.log(
    `  Reconciliation active: ${res.data.syncSubsystem.reconciliation.schedulerActive}`,
  );

  if (!res.data.timestamp) {
    throw new Error("Missing timestamp in health response");
  }

  if (res.data.status !== "healthy" && res.data.status !== "degraded") {
    throw new Error(`Unexpected health status: ${res.data.status}`);
  }

  console.log("✅ Health endpoint test passed");
}

async function testLegacyRoutes() {
  console.log("\n=== Test 9: Legacy Routes Compatibility ===");

  // Test legacy /day route
  const latestRes = await axios.get(`${API_URL}/matches/latest?limit=1`);
  if (latestRes.data.count > 0) {
    const date = latestRes.data.data[0].date;
    const res = await axios.get(`${API_URL}/matches/day?date=${date}`);
    console.log(`✅ Legacy /matches/day route: ${res.data.count} matches`);
  }

  // Test legacy /history route
  const res2 = await axios.get(
    `${API_URL}/leaderboard/history?from=2025-01-01&to=2025-12-31`,
  );
  console.log(
    `✅ Legacy /leaderboard/history route: ${res2.data.count} players`,
  );

  console.log("✅ Legacy routes test passed");
}

async function testPerformance() {
  console.log("\n=== Test 10: Performance ===");

  // Test response time
  const start = Date.now();
  await axios.get(`${API_URL}/matches/latest?limit=100`);
  const duration = Date.now() - start;

  console.log(`✅ Response time for 100 matches: ${duration}ms`);

  if (duration > 1000) {
    console.log(
      `⚠️  Response time > 1s (${duration}ms) - may need optimization`,
    );
  }

  console.log("✅ Performance test completed");
}

// Main test runner
async function main() {
  console.log("🧪 Phase 6 Verification: HTTP API Endpoints\n");
  console.log(`Testing server at ${BASE_URL}\n`);

  try {
    // Check if server is running
    try {
      await axios.get(BASE_URL);
    } catch (error: unknown) {
      throw new Error(
        `Server is not running at ${BASE_URL}. Please start the server first.`,
      );
    }

    await testMatchesLatest();
    await testMatchesByDate();
    await testPlayers();
    await testPlayerMatches();
    await testPlayerStats();
    await testLeaderboardToday();
    await testLeaderboardDateRange();
    await testHealth();
    await testLegacyRoutes();
    await testPerformance();

    console.log("\n✅ ========================================");
    console.log("✅ ALL PHASE 6 TESTS PASSED!");
    console.log("✅ ========================================\n");

    console.log("🎉 All HTTP API endpoints are working correctly!");
    console.log("\nAPI Endpoints:");
    console.log("  GET /api/matches/latest?limit=N");
    console.log("  GET /api/matches?date=YYYY-MM-DD");
    console.log("  GET /api/players");
    console.log("  GET /api/players/:name/matches");
    console.log("  GET /api/players/:name/stats");
    console.log("  GET /api/leaderboard/today");
    console.log("  GET /api/leaderboard?from=DATE&to=DATE");
    console.log("  GET /health");
  } catch (error: unknown) {
    console.error("\n❌ Test failed:");
    if (axios.isAxiosError(error)) {
      console.error(`  HTTP ${error.response?.status}: ${error.message}`);
      console.error(`  Response:`, error.response?.data);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
