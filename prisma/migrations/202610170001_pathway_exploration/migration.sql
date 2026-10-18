CREATE TABLE "PathwayExploration" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "preferences" JSONB NOT NULL,
  "suggestions" JSONB NOT NULL DEFAULT '[]',
  "inputRevision" INTEGER NOT NULL,
  "libraryVersion" TEXT NOT NULL,
  "selectedSuggestionId" TEXT,
  "operationId" TEXT,
  CONSTRAINT "PathwayExploration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
