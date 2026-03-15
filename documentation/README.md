RPS League Backend Infrastructure Documentation
1. Overview

This document describes the infrastructure and architecture of the Rock-Paper-Scissors (RPS) League backend system. The system consumes a legacy API that provides historical match data and a live event stream, stores normalized match data in a PostgreSQL database, and exposes a clean HTTP API for frontend applications.

The backend architecture is designed to handle large historical datasets efficiently while providing fast query responses for the frontend. To achieve this, the system separates data ingestion from data serving using two internal subsystems.

The backend runs as a single Node.js process with two logical subsystems:

Sync subsystem – responsible for ingesting data from the legacy API.

HTTP API subsystem – responsible for serving client requests using the local database.

Both subsystems share a common PostgreSQL database.

2. Technology Stack
Backend

Node.js

Express

TypeScript

PostgreSQL

Prisma ORM

Axios (for legacy API HTTP requests)

EventSource (for Server-Sent Events connection)

dotenv (environment configuration)

cors (frontend communication)

zod (request validation)

pino (logging)

Frontend

React

3. High-Level System Architecture
React Frontend
       |
       v
HTTP API Subsystem (Express)
       |
       v
PostgreSQL Database
       ^
       |
Sync Subsystem
   |        |
   |        |
/history   /live (SSE stream)
Legacy API

The backend mirrors data from the legacy API into its own PostgreSQL database. The frontend only interacts with the backend API and never directly communicates with the legacy API.

4. Core Architectural Principle

The system follows a database-first architecture:

Legacy API data is ingested and stored locally.

The backend serves all queries from the database.

The frontend never interacts directly with the legacy API.

This approach provides several advantages:

Fast frontend queries

Reduced load on the legacy API

Simplified frontend logic

Protection of the legacy API access token

Efficient querying using SQL

5. Process Model

The backend runs as one Node.js process containing two subsystems.

Single Process Model
Node Process
   |
   |--- Sync Subsystem
   |
   |--- HTTP API Subsystem

Both subsystems operate concurrently using asynchronous operations.

Sync Subsystem

Continuously ingests data from the legacy API.

HTTP API Subsystem

Handles client requests from the frontend.

6. Sync Subsystem

The sync subsystem is responsible for ingesting match data from the legacy API and inserting it into the database.

It performs three tasks:

Historical backfill

Live event ingestion

Periodic reconciliation

7. Historical Backfill

The legacy /history endpoint contains large paginated datasets with potentially hundreds of thousands of records. Because of this, historical data must be imported progressively.

Backfill Strategy

Backfill is performed using a checkpointed cursor approach.

Steps:

Fetch a page from /history.

Transform each match into the normalized database format.

Upsert players and matches.

Save the next cursor in the database.

Continue from the stored cursor during the next cycle.

This allows the backfill process to be:

resumable

incremental

safe from restarts

Backfill continues until no additional cursor is returned.

8. Live Event Ingestion (SSE)

The legacy API provides a /live endpoint using Server-Sent Events (SSE). This stream pushes new match results in real time.

The backend establishes a persistent connection to this endpoint and processes incoming events.

SSE Workflow
Connect to /live
      |
Receive event
      |
Transform match
      |
Upsert into database

This ensures the database receives new matches immediately without polling.

If the connection drops, the system automatically reconnects.

9. Periodic Reconciliation

Even with SSE, a small reconciliation job is necessary to handle:

missed events

connection interruptions

late-arriving matches

The reconciliation job runs periodically (for example every 10 minutes).

Steps:

Fetch the newest page from /history.

Insert any matches not already in the database.

Stop once known matches are encountered.

This ensures the database stays consistent with the legacy source.

10. Deduplication Strategy

Both /history and /live may contain overlapping data. To prevent duplicates, the database enforces uniqueness using the legacy gameId.

All match inserts use upsert logic.

gameId UNIQUE

If the match already exists, the insert is ignored.

This ensures safe ingestion from multiple sources.

11. HTTP API Subsystem

The HTTP API subsystem exposes REST endpoints that serve match data from the database.

The frontend communicates only with this API.

Example endpoints include:

GET /api/matches/latest
GET /api/matches?date=YYYY-MM-DD
GET /api/players/:name/matches
GET /api/leaderboard/today
GET /api/leaderboard?from=DATE&to=DATE

Each endpoint:

validates parameters

queries PostgreSQL

returns JSON responses

The API never calls the legacy API directly.

12. Database Design

The system uses three main tables.

Player Table

Stores unique players.

Fields include:

id

name

createdAt

updatedAt

Player names are unique identifiers.

Match Table

Stores normalized match results.

Fields include:

gameId (unique)

playedAt

playedDate

playerAId

playerBId

playerAChoice

playerBChoice

resultType

winnerPlayerId

loserPlayerId

ingestion source

This structure supports all assignment features efficiently.

SyncState Table

Tracks synchronization progress.

Fields include:

backfill cursor

backfill completion status

last sync timestamps

latest known match time

job running flags

This table allows synchronization to be resumable and safe.

13. Data Transformation

The legacy /history response lacks some fields required by the application.

Before storing a match, the backend computes additional data:

match winner

match loser

draw status

normalized timestamp

normalized date

Example transformation:

Legacy event
    |
Determine winner
    |
Normalize timestamp
    |
Insert normalized match
14. Concurrency Model

Both subsystems can operate simultaneously.

Example scenario:

the sync subsystem receives an SSE event and writes a new match to the database

at the same time the API subsystem responds to a leaderboard query

PostgreSQL supports concurrent reads and writes, making this safe.

15. Handling Partial Data

During initial backfill, the database may not yet contain the full match history.

As a result:

early queries may return partial results

historical queries improve as backfill progresses

This behavior is acceptable for the assignment.

16. Security Considerations

Important security practices include:

the legacy API token is stored in environment variables

the frontend never receives the legacy token

database credentials are stored in .env

the frontend cannot connect directly to PostgreSQL

17. Application Startup Sequence

When the backend starts:

environment variables are loaded

database connection is initialized

Express server starts

SSE connection to /live is established

backfill synchronization begins

The server does not wait for full history ingestion before accepting requests.

18. Backend Folder Structure

Example backend structure:

src/
  app.ts
  server.ts

  config/
    env.ts

  db/
    prisma.ts

  api/
    matches/
    players/
    leaderboard/

  sync/
    historyBackfill.ts
    liveStream.ts
    reconciliation.ts
    syncRunner.ts

  legacy/
    legacyApiClient.ts

  transformers/
    matchTransformer.ts
    rpsLogic.ts

  utils/
    logger.ts

This structure separates ingestion, API logic, and transformation code.

19. Advantages of This Architecture

This infrastructure provides several key benefits:

scalable querying via PostgreSQL

fast frontend responses

reduced dependency on legacy API performance

safe ingestion of large historical datasets

real-time updates via SSE

simplified frontend integration

clear separation of responsibilities

20. Limitations

The first version has some limitations:

the sync subsystem and API subsystem share a single process

full backfill may take time

historical data may initially be incomplete

These limitations are acceptable for the assignment.