-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "intakeAnswers" JSONB;

-- AlterTable
ALTER TABLE "EventType" ADD COLUMN     "intake" JSONB;

-- AlterTable
ALTER TABLE "Negotiation" ADD COLUMN     "intakeAnswers" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "participants" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "preferredStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "domainToken" SET DEFAULT md5(random()::text);

