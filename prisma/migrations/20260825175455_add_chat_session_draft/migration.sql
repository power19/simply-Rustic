-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phone" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'MAIN',
    "categoryId" INTEGER,
    "cartJson" TEXT NOT NULL DEFAULT '[]',
    "draftJson" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ChatSession" ("cartJson", "categoryId", "id", "phone", "step", "updatedAt") SELECT "cartJson", "categoryId", "id", "phone", "step", "updatedAt" FROM "ChatSession";
DROP TABLE "ChatSession";
ALTER TABLE "new_ChatSession" RENAME TO "ChatSession";
CREATE UNIQUE INDEX "ChatSession_phone_key" ON "ChatSession"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
