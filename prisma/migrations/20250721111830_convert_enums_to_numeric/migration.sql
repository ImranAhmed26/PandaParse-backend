/*
  Warnings:

  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `ownerType` on the `Workspace` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "role" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "ownerType",
ADD COLUMN     "ownerType" INTEGER NOT NULL;

-- DropEnum
DROP TYPE "OwnerType";

-- DropEnum
DROP TYPE "UserRole";
