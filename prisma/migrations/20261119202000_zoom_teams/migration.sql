-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LocationType" ADD VALUE 'MS_TEAMS';
ALTER TYPE "LocationType" ADD VALUE 'ZOOM';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "zoomMeetingId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "domainToken" SET DEFAULT md5(random()::text);

-- CreateTable
CREATE TABLE "ZoomConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zoomUserId" TEXT NOT NULL,
    "email" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZoomConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZoomConnection_userId_key" ON "ZoomConnection"("userId");

-- AddForeignKey
ALTER TABLE "ZoomConnection" ADD CONSTRAINT "ZoomConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

