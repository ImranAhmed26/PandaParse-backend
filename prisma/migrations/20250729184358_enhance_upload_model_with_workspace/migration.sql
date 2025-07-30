-- AlterTable
ALTER TABLE "Upload" ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "workspaceId" TEXT;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
