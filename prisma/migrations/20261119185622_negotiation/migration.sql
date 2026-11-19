-- CreateEnum
CREATE TYPE "NegotiationStatus" AS ENUM ('OPEN', 'AWAITING_APPROVAL', 'BOOKED', 'DECLINED', 'CLOSED');

-- AlterTable
ALTER TABLE "EventType" ADD COLUMN     "negotiation" JSONB;

-- CreateTable
CREATE TABLE "Negotiation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventTypeId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "status" "NegotiationStatus" NOT NULL DEFAULT 'OPEN',
    "apiMessages" JSONB NOT NULL DEFAULT '[]',
    "transcript" JSONB NOT NULL DEFAULT '[]',
    "knownSlots" JSONB NOT NULL DEFAULT '[]',
    "pendingStart" TIMESTAMP(3),
    "pendingReason" TEXT,
    "approvalToken" TEXT,
    "bookingId" TEXT,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Negotiation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Negotiation_token_key" ON "Negotiation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Negotiation_approvalToken_key" ON "Negotiation"("approvalToken");

-- CreateIndex
CREATE INDEX "Negotiation_organizationId_createdAt_idx" ON "Negotiation"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Negotiation" ADD CONSTRAINT "Negotiation_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "EventType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
