/*
  Warnings:

  - The `status` column on the `Job` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Upload` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "TokenTransactionType" AS ENUM ('PURCHASE', 'CONSUME', 'ADJUSTMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'processing', 'failed', 'success');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('uploaded', 'processing', 'complete', 'failed');

-- AlterTable
ALTER TABLE "DocumentResult" ALTER COLUMN "jsonUrl" DROP NOT NULL,
ALTER COLUMN "csvUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "errorCode" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "JobStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Upload" DROP COLUMN "status",
ADD COLUMN     "status" "UploadStatus" NOT NULL DEFAULT 'uploaded';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyId" TEXT,
ALTER COLUMN "name" SET NOT NULL;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenBalance" (
    "id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,

    CONSTRAINT "TokenBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenTransaction" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "TokenTransactionType" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenBalanceId" TEXT NOT NULL,

    CONSTRAINT "TokenTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TokenBalance_companyId_key" ON "TokenBalance"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenBalance_userId_key" ON "TokenBalance"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenBalance" ADD CONSTRAINT "TokenBalance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenBalance" ADD CONSTRAINT "TokenBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenTransaction" ADD CONSTRAINT "TokenTransaction_tokenBalanceId_fkey" FOREIGN KEY ("tokenBalanceId") REFERENCES "TokenBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
