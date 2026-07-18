-- Support Google (OAuth) accounts and account linking.

-- Password is optional now: OAuth-only accounts have no password.
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

-- Google profile picture + linked Google account subject + verification flag.
ALTER TABLE "User" ADD COLUMN "image" TEXT;
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- One Google account maps to at most one user.
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
