-- CreateIndex
CREATE INDEX "Click_linkId_timestamp_idx" ON "Click"("linkId", "timestamp");

-- DropIndex
DROP INDEX "Click_linkId_idx";
