-- CreateIndex
CREATE INDEX "WorkspaceDocument_workspaceId_idx" ON "WorkspaceDocument"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceDocument_documentId_idx" ON "WorkspaceDocument"("documentId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_workspaceId_idx" ON "WorkspaceMember"("userId", "workspaceId");
