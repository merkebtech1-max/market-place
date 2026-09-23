-- DropIndex
DROP INDEX "ListingImage_listingId_idx";

-- CreateIndex
CREATE INDEX "ListingImage_listingId_position_idx" ON "ListingImage"("listingId", "position");