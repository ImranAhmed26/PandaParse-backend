-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'INTERNAL', 'USER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';
