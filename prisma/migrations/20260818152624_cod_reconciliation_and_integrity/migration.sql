-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Carrier" ADD COLUMN     "settlementDays" INTEGER NOT NULL DEFAULT 14;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "codAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "codCollected" DECIMAL(12,2),
ADD COLUMN     "codFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastStatusDetail" TEXT,
ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "returnFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "settledAt" TIMESTAMP(3),
ADD COLUMN     "shippingCost" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StatusDefinition" ADD COLUMN     "allowedNext" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "OrderCounter" (
    "organizationId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderCounter_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "CarrierRate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "returnFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "codFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "source" TEXT NOT NULL DEFAULT 'sync',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Remittance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "carrierId" TEXT,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "declaredTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "matchedTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "feeTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "varianceTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Remittance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemittanceLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "remittanceId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "awb" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unmatched',
    "declaredAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "feeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "variance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemittanceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "payload" JSONB NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "orderId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "InboundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB NOT NULL DEFAULT '{}',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarrierRate_organizationId_city_idx" ON "CarrierRate"("organizationId", "city");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierRate_carrierId_city_key" ON "CarrierRate"("carrierId", "city");

-- CreateIndex
CREATE INDEX "ShipmentEvent_shipmentId_createdAt_idx" ON "ShipmentEvent"("shipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "Remittance_organizationId_status_idx" ON "Remittance"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Remittance_organizationId_reference_key" ON "Remittance"("organizationId", "reference");

-- CreateIndex
CREATE INDEX "RemittanceLine_organizationId_awb_idx" ON "RemittanceLine"("organizationId", "awb");

-- CreateIndex
CREATE INDEX "RemittanceLine_organizationId_status_idx" ON "RemittanceLine"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RemittanceLine_remittanceId_awb_key" ON "RemittanceLine"("remittanceId", "awb");

-- CreateIndex
CREATE INDEX "InboundEvent_organizationId_createdAt_idx" ON "InboundEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "InboundEvent_organizationId_status_idx" ON "InboundEvent"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEvent_organizationId_provider_externalId_key" ON "InboundEvent"("organizationId", "provider", "externalId");

-- CreateIndex
CREATE INDEX "JobRun_organizationId_createdAt_idx" ON "JobRun"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");

-- CreateIndex
CREATE INDEX "Order_organizationId_status_createdAt_idx" ON "Order"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Shipment_organizationId_status_idx" ON "Shipment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Shipment_organizationId_settledAt_idx" ON "Shipment"("organizationId", "settledAt");

-- AddForeignKey
ALTER TABLE "CarrierRate" ADD CONSTRAINT "CarrierRate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierRate" ADD CONSTRAINT "CarrierRate_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remittance" ADD CONSTRAINT "Remittance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remittance" ADD CONSTRAINT "Remittance_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceLine" ADD CONSTRAINT "RemittanceLine_remittanceId_fkey" FOREIGN KEY ("remittanceId") REFERENCES "Remittance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceLine" ADD CONSTRAINT "RemittanceLine_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEvent" ADD CONSTRAINT "InboundEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: seed the per-org order counter from existing numbers so the first
-- number issued by the new atomic sequence cannot collide with history.
INSERT INTO "OrderCounter" ("organizationId", "value", "updatedAt")
SELECT
  o."organizationId",
  GREATEST(
    COUNT(*)::int,
    COALESCE(MAX(NULLIF(regexp_replace(o."number", '\D', '', 'g'), ''))::bigint - 10000, 0)::int
  ),
  now()
FROM "Order" o
GROUP BY o."organizationId"
ON CONFLICT ("organizationId") DO NOTHING;

-- Backfill: shipments predate COD amount tracking; take it from their order.
UPDATE "Shipment" s
SET "codAmount" = o."codAmount"
FROM "Order" o
WHERE s."orderId" = o."id" AND s."codAmount" = 0;

-- Backfill: give the built-in statuses their default transition graph so the
-- state machine is enforced for organizations created before this migration.
UPDATE "StatusDefinition" SET "allowedNext" = CASE "key"
  WHEN 'NEW' THEN ARRAY['TO_CONFIRM','CALLING','CONFIRMED','CANCELLED']
  WHEN 'TO_CONFIRM' THEN ARRAY['CALLING','NO_ANSWER','CALLBACK','CONFIRMED','CANCELLED']
  WHEN 'CALLING' THEN ARRAY['TO_CONFIRM','NO_ANSWER','CALLBACK','CONFIRMED','CANCELLED']
  WHEN 'NO_ANSWER' THEN ARRAY['TO_CONFIRM','CALLING','CALLBACK','CONFIRMED','CANCELLED']
  WHEN 'CALLBACK' THEN ARRAY['TO_CONFIRM','CALLING','NO_ANSWER','CONFIRMED','CANCELLED']
  WHEN 'CONFIRMED' THEN ARRAY['PREPARING','SHIPPED','CANCELLED']
  WHEN 'PREPARING' THEN ARRAY['SHIPPED','CANCELLED']
  WHEN 'SHIPPED' THEN ARRAY['OUT_FOR_DELIVERY','DELIVERED','RETURNED','CANCELLED']
  WHEN 'OUT_FOR_DELIVERY' THEN ARRAY['DELIVERED','SHIPPED','RETURNED']
  WHEN 'DELIVERED' THEN ARRAY['RETURNED']
  ELSE ARRAY[]::text[]
END
WHERE "key" IN ('NEW','TO_CONFIRM','CALLING','NO_ANSWER','CALLBACK','CONFIRMED','PREPARING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED');
