-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'REVOKED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('POLAR', 'SEPAY');

-- CreateEnum
CREATE TYPE "WebhookEventType" AS ENUM ('SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_ACTIVE', 'SUBSCRIPTION_CANCELED', 'SUBSCRIPTION_UNCANCELED', 'SUBSCRIPTION_REVOKED', 'ORDER_CREATED', 'ORDER_UPDATED', 'ORDER_PAID', 'ORDER_REFUNDED', 'PAYMENT_IN', 'PAYMENT_OUT', 'PAYMENT_VERIFIED');

-- CreateTable
CREATE TABLE "guilds" (
    "id" TEXT NOT NULL,
    "guildId" VARCHAR(20) NOT NULL,
    "guildName" VARCHAR(100) NOT NULL,
    "prefix" VARCHAR(10) NOT NULL DEFAULT '!',
    "locale" VARCHAR(5) NOT NULL DEFAULT 'en',
    "polarEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sepayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paid_roles" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" VARCHAR(20) NOT NULL,
    "roleName" VARCHAR(100) NOT NULL,
    "priceUsd" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "polarProductId" VARCHAR(255),
    "sepayProductId" VARCHAR(255),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "userId" VARCHAR(20) NOT NULL,
    "guildId" TEXT NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "discriminator" VARCHAR(4),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "externalSubscriptionId" VARCHAR(255) NOT NULL,
    "externalCustomerId" VARCHAR(255),
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "externalEventId" VARCHAR(255) NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "eventType" "WebhookEventType" NOT NULL,
    "subscriptionId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guilds_guildId_key" ON "guilds"("guildId");

-- CreateIndex
CREATE INDEX "guilds_guildId_idx" ON "guilds"("guildId");

-- CreateIndex
CREATE INDEX "paid_roles_guildId_idx" ON "paid_roles"("guildId");

-- CreateIndex
CREATE INDEX "paid_roles_roleId_idx" ON "paid_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "paid_roles_guildId_roleId_key" ON "paid_roles"("guildId", "roleId");

-- CreateIndex
CREATE INDEX "members_userId_idx" ON "members"("userId");

-- CreateIndex
CREATE INDEX "members_guildId_idx" ON "members"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "members_userId_guildId_key" ON "members"("userId", "guildId");

-- CreateIndex
CREATE INDEX "subscriptions_memberId_idx" ON "subscriptions"("memberId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_provider_idx" ON "subscriptions"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_externalSubscriptionId_provider_key" ON "subscriptions"("externalSubscriptionId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_externalEventId_key" ON "webhook_events"("externalEventId");

-- CreateIndex
CREATE INDEX "webhook_events_externalEventId_idx" ON "webhook_events"("externalEventId");

-- CreateIndex
CREATE INDEX "webhook_events_provider_idx" ON "webhook_events"("provider");

-- CreateIndex
CREATE INDEX "webhook_events_processed_idx" ON "webhook_events"("processed");

-- CreateIndex
CREATE INDEX "webhook_events_eventType_idx" ON "webhook_events"("eventType");

-- AddForeignKey
ALTER TABLE "paid_roles" ADD CONSTRAINT "paid_roles_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "paid_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
