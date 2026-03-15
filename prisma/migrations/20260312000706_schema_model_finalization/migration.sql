-- CreateEnum
CREATE TYPE "MatchResultType" AS ENUM ('PLAYER_A_WIN', 'PLAYER_B_WIN', 'DRAW');

-- CreateEnum
CREATE TYPE "SyncSource" AS ENUM ('HISTORY_BACKFILL', 'HISTORY_RECONCILIATION', 'LIVE_SSE');

-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "gameId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "playedDate" TIMESTAMP(3) NOT NULL,
    "playerAId" INTEGER NOT NULL,
    "playerBId" INTEGER NOT NULL,
    "playerAChoice" "Move" NOT NULL,
    "playerBChoice" "Move" NOT NULL,
    "resultType" "MatchResultType" NOT NULL,
    "winnerPlayerId" INTEGER,
    "loserPlayerId" INTEGER,
    "ingestedFrom" "SyncSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "backfillCursor" TEXT,
    "backfillCompleted" BOOLEAN NOT NULL DEFAULT false,
    "lastBackfillRunAt" TIMESTAMP(3),
    "lastReconcileRunAt" TIMESTAMP(3),
    "lastSseEventAt" TIMESTAMP(3),
    "latestKnownMatchTime" TIMESTAMP(3),
    "latestKnownGameId" TEXT,
    "sseConnected" BOOLEAN NOT NULL DEFAULT false,
    "isBackfillRunning" BOOLEAN NOT NULL DEFAULT false,
    "isReconcileRunning" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_key" ON "Player"("name");

-- CreateIndex
CREATE INDEX "Player_name_idx" ON "Player"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Match_gameId_key" ON "Match"("gameId");

-- CreateIndex
CREATE INDEX "Match_playedAt_idx" ON "Match"("playedAt");

-- CreateIndex
CREATE INDEX "Match_playedDate_idx" ON "Match"("playedDate");

-- CreateIndex
CREATE INDEX "Match_playerAId_idx" ON "Match"("playerAId");

-- CreateIndex
CREATE INDEX "Match_playerBId_idx" ON "Match"("playerBId");

-- CreateIndex
CREATE INDEX "Match_winnerPlayerId_idx" ON "Match"("winnerPlayerId");

-- CreateIndex
CREATE INDEX "Match_playedDate_winnerPlayerId_idx" ON "Match"("playedDate", "winnerPlayerId");

-- CreateIndex
CREATE INDEX "Match_playedAt_winnerPlayerId_idx" ON "Match"("playedAt", "winnerPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_key_key" ON "SyncState"("key");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerPlayerId_fkey" FOREIGN KEY ("winnerPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_loserPlayerId_fkey" FOREIGN KEY ("loserPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
