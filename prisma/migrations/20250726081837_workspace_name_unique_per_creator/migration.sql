/*
  Warnings:

  - A unique constraint covering the columns `[creatorId,name]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Workspace_ownerId_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_creatorId_name_key" ON "Workspace"("creatorId", "name");
