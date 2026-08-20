-- Add a dedicated notification type column.
-- Existing rows are left NULL (type was previously overloaded onto referenceType);
-- new notifications set it explicitly going forward.
ALTER TABLE "notification_events" ADD COLUMN "type" VARCHAR(50);

-- CreateIndex
CREATE INDEX "notification_events_type_idx" ON "notification_events"("type");
CREATE INDEX "notification_events_type_createdAt_idx" ON "notification_events"("type", "createdAt");

-- CreateTable
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'SKIPPED');

CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_deliveries_notificationId_idx" ON "notification_deliveries"("notificationId");
CREATE INDEX "notification_deliveries_notificationId_channel_idx" ON "notification_deliveries"("notificationId", "channel");

-- AddForeignKey
ALTER TABLE "notification_deliveries"
ADD CONSTRAINT "notification_deliveries_notificationId_fkey"
FOREIGN KEY ("notificationId") REFERENCES "notification_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
