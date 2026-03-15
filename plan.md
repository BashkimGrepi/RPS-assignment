## Plan: RPS League Backend System - Implementation Roadmap

Build a complete Rock-Paper-Scissors League backend with **two subsystems**: a **Sync Subsystem** (ingests data from legacy API via historical backfill, live SSE stream, and periodic reconciliation) and an **HTTP API Subsystem** (serves frontend requests from PostgreSQL). The system follows a database-first architecture where all legacy data is mirrored locally for fast queries.

**Current State:**

- ✅ Database schema complete (Player, Match, SyncState models)
- ✅ HTTP API routes fully implemented
- ✅ **Phase 1 Complete** - Foundation & Data Transformation
- ✅ **Phase 2 Complete** - Historical Backfill System
- ✅ **Phase 3 Complete** - Live SSE Stream
- ✅ **Phase 4 Complete** - Periodic Reconciliation
- ✅ **Phase 5 Complete** - Integration & Startup
- ✅ **Phase 6 Complete** - HTTP API Endpoints
- ❌ Phase 7 - Error Handling & Logging (basic only)
- ❌ Phase 8 - Testing & Documentation (partial)

---

### **Phase 1: Foundation & Data Transformation** ✅ COMPLETE

_Core utilities needed by both subsystems_

1. Create RPS game logic in rpsLogic.ts - determine winner from moves
2. Create match transformer in `src/transformers/matchTransformer.ts` - convert legacy format to normalized database format
3. Create database upsert utilities in `src/db/upsertHelpers.ts` - `upsertPlayer()` and `upsertMatch()` with deduplication

**Verification:**

1. Unit tests for all 9 move combinations (ROCK vs ROCK, ROCK vs PAPER, etc.)
2. Test transformation with sample legacy data
3. Test upsert ignores duplicate gameId

---

### **Phase 2: Sync Subsystem - Historical Backfill** ✅ COMPLETE

_Progressive import of historical data with checkpointed pagination_

1. Create `src/sync/historyBackfill.ts` - fetch pages, transform, upsert, save cursor
2. Create `src/sync/backfillOrchestrator.ts` - runs backfill cycles in background loop until complete
3. Uses SyncState table to track cursor and resumability
4. Rate limiting: 100ms delay between pages

**Verification:**

1. Start server - backfill begins automatically
2. Stop/restart mid-backfill - resumes from saved cursor
3. Verify matches populate database
4. Monitor SyncState for cursor updates

**Depends on:** Phase 1

---

### **Phase 3: Sync Subsystem - Live SSE Stream** ✅ COMPLETE

_Real-time match ingestion from Server-Sent Events_

1. Create `src/sync/liveStream.ts` - EventSource client for `/live` endpoint
2. Parse events → transform → upsert (tagged with `LIVE_SSE` source)
3. Auto-reconnect on connection drop (exponential backoff: 1s→2s→4s, max 30s)
4. Update `sseConnected` and `lastSseEventAt` in SyncState

**Verification:**

1. Verify SSE connection establishes on startup
2. New matches appear in database within seconds
3. Kill connection - verify auto-reconnect
4. Check SyncState shows `sseConnected = true`

**Depends on:** Phase 1
_Parallel with Phase 2_

---

### **Phase 4: Sync Subsystem - Periodic Reconciliation** ✅ COMPLETE

_Fill gaps from missed SSE events_

1. Create `src/sync/reconciliation.ts` - fetch newest `/history` page and upsert all matches
2. Create `src/sync/reconciliationScheduler.ts` - runs every 10 minutes via setInterval
3. Tagged with `HISTORY_RECONCILIATION` source
4. Single page fetch is sufficient to catch recent gaps

**Verification:**

1. Wait 10 minutes - verify reconciliation runs
2. Database shows mix of `LIVE_SSE` and `HISTORY_RECONCILIATION` sources
3. No duplicate gameIds created

**Depends on:** Phase 1
_Parallel with Phases 2 & 3_

---

### **Phase 5: Sync Subsystem - Integration & Startup** ✅ COMPLETE

_Wire all sync components together_

1. Create `src/sync/syncRunner.ts` - `startSyncSubsystem()` starts all three sync processes
2. Update index.ts - call `startSyncSubsystem()` at server startup (don't await)
3. Add graceful shutdown handler
4. Initialize SyncState record if not exists

**Verification:**

1. Fresh server with empty database
2. All three sync processes start (check logs)
3. Matches appear in database within 30 seconds
4. SyncState shows active flags
5. Ctrl+C triggers graceful shutdown

**Depends on:** Phases 2, 3, 4

---

### **Phase 6: HTTP API Subsystem - Complete Endpoints** ✅ COMPLETE

_Implement all REST endpoints serving from database_

1. Add missing endpoints:
   - `GET /api/matches/latest` - most recent N matches
   - `GET /api/matches?date=YYYY-MM-DD` - matches for specific date
   - `GET /api/players/:name/matches` - player's matches
   - `GET /api/leaderboard/today` - today's win counts
   - `GET /api/leaderboard?from=DATE&to=DATE` - date range leaderboard

2. Add Zod request validation (400 for invalid inputs)
3. Implement database queries in service layer using Prisma

**Verification:**

1. Test each endpoint with curl/Postman
2. Invalid inputs return 400 errors
3. Load test 1000 requests - response time <100ms
4. Partial data returns correctly during backfill

_Parallel with Phases 1-5_

---

### **Phase 7: Error Handling & Logging**

_Production-ready reliability_

1. Add pino structured logging - sync events, API requests, errors
2. Add error handlers - try-catch in sync functions, Express error middleware
3. Add retry logic - 3 attempts with exponential backoff for legacy API calls

**Verification:**

1. Simulate legacy API failure - verify retries
2. Invalid API request returns 400 with message
3. Review logs for sync progress
4. Database connection loss triggers recovery

**Depends on:** Phases 2, 3, 4, 6

---

### **Phase 8: Testing & Documentation**

_Final polish_

1. Write integration tests - backfill, SSE, API endpoints, deduplication
2. Update documentation - environment variables, API docs, troubleshooting
3. Add `GET /health` endpoint - shows database connection, SSE status, backfill progress

**Verification:**

1. All tests pass
2. Documentation complete
3. `/health` returns current system status

**Depends on:** All previous phases

---

### **Relevant Files:**

**To create:**

- `src/sync/historyBackfill.ts`
- `src/sync/liveStream.ts`
- `src/sync/reconciliation.ts`
- `src/sync/backfillOrchestrator.ts`
- `src/sync/reconciliationScheduler.ts`
- `src/sync/syncRunner.ts`
- `src/transformers/matchTransformer.ts`
- `src/db/upsertHelpers.ts`

**To modify:**

- rpsLogic.ts
- index.ts
- matches.routes.ts
- matches.service.ts

---

### **Decisions:**

**Included:**

- Single-process architecture (both subsystems in one Node.js process)
- All three sync mechanisms (backfill, SSE, reconciliation)
- Deduplication via gameId uniqueness
- Resumable backfill with cursor checkpointing

**Excluded:**

- Multi-process architecture
- Waiting for full backfill before accepting requests
- Advanced caching (Redis)
- WebSocket bidirectional communication

**Key Assumptions:**

- Legacy API remains stable
- Partial data during backfill is acceptable
- 100ms delay prevents rate limiting
- One reconciliation page catches gaps

---

### **Timeline:**

**Week 1:** Phase 1 (Foundation) + Phase 2 (Backfill) + Phase 6 (API endpoints in parallel)

**Week 2:** Phase 3 (SSE) + Phase 4 (Reconciliation) + Phase 7 (Error handling in parallel)

**Week 3:** Phase 5 (Integration) + Phase 8 (Testing & docs)
