-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "publishStatus" TEXT NOT NULL DEFAULT 'none',
    "publishNote" TEXT,
    "ownerId" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL DEFAULT 'link',
    "htmlEntry" TEXT,
    "htmlBytes" INTEGER NOT NULL DEFAULT 0,
    "htmlAccessToken" TEXT,
    "htmlDraftEntry" TEXT,
    "htmlDraftBytes" INTEGER NOT NULL DEFAULT 0,
    "htmlUpdateStatus" TEXT NOT NULL DEFAULT 'none',
    "htmlUpdateNote" TEXT,
    CONSTRAINT "Tool_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Tool" ("addedAt", "category", "description", "htmlAccessToken", "htmlBytes", "htmlEntry", "icon", "id", "kind", "name", "order", "ownerId", "publishNote", "publishStatus", "source", "tags", "url", "visibility") SELECT "addedAt", "category", "description", "htmlAccessToken", "htmlBytes", "htmlEntry", "icon", "id", "kind", "name", "order", "ownerId", "publishNote", "publishStatus", "source", "tags", "url", "visibility" FROM "Tool";
DROP TABLE "Tool";
ALTER TABLE "new_Tool" RENAME TO "Tool";
CREATE UNIQUE INDEX "Tool_htmlAccessToken_key" ON "Tool"("htmlAccessToken");
CREATE INDEX "Tool_category_visibility_idx" ON "Tool"("category", "visibility");
CREATE INDEX "Tool_ownerId_idx" ON "Tool"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
