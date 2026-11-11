-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_request_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "requestHeaders" JSONB,
    "bodyType" TEXT NOT NULL DEFAULT 'NONE',
    "requestBody" TEXT,
    "statusCode" INTEGER,
    "statusText" TEXT,
    "durationMs" INTEGER NOT NULL,
    "responseSize" INTEGER NOT NULL DEFAULT 0,
    "responseHeaders" JSONB,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "request_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_request_history" ("createdAt", "durationMs", "errorMessage", "id", "method", "requestBody", "requestHeaders", "responseBody", "responseHeaders", "responseSize", "statusCode", "statusText", "url", "userId") SELECT "createdAt", "durationMs", "errorMessage", "id", "method", "requestBody", "requestHeaders", "responseBody", "responseHeaders", "responseSize", "statusCode", "statusText", "url", "userId" FROM "request_history";
DROP TABLE "request_history";
ALTER TABLE "new_request_history" RENAME TO "request_history";
CREATE INDEX "request_history_userId_createdAt_idx" ON "request_history"("userId", "createdAt");
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "avatarUrl" TEXT,
    "bio" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("avatarUrl", "bio", "createdAt", "email", "id", "isActive", "lastLoginAt", "name", "passwordHash", "role", "updatedAt") SELECT "avatarUrl", "bio", "createdAt", "email", "id", "isActive", "lastLoginAt", "name", "passwordHash", "role", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
