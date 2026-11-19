-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "calendarProvider" TEXT NOT NULL DEFAULT 'google',
ADD COLUMN     "rescheduledFromId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "customDomain" TEXT,
ADD COLUMN     "domainToken" TEXT NOT NULL DEFAULT md5(random()::text),
ADD COLUMN     "domainVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_customDomain_key" ON "Organization"("customDomain");

