-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_commissionTierId_fkey";

-- AlterTable
ALTER TABLE "Reservation" ALTER COLUMN "commissionTierId" DROP NOT NULL,
ALTER COLUMN "commissionCents" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_commissionTierId_fkey" FOREIGN KEY ("commissionTierId") REFERENCES "CommissionTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
