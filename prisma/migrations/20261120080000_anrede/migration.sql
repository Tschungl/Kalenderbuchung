-- CreateEnum
CREATE TYPE "Salutation" AS ENUM ('SIE', 'DU');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "salutation" "Salutation" NOT NULL DEFAULT 'SIE',
ALTER COLUMN "domainToken" SET DEFAULT md5(random()::text);

