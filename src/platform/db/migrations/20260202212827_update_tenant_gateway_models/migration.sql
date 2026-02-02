-- CreateEnum
CREATE TYPE "GatewayStatus" AS ENUM ('PROVISIONING', 'STARTING', 'HEALTHY', 'UNHEALTHY', 'STOPPING', 'STOPPED', 'FAILED');

-- CreateTable
CREATE TABLE "TenantGateway" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "pid" INTEGER,
    "status" "GatewayStatus" NOT NULL DEFAULT 'PROVISIONING',
    "lastHealthCheck" TIMESTAMP(3),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "memoryMb" INTEGER,
    "cpuPercent" DOUBLE PRECISION,
    "activeSessions" INTEGER NOT NULL DEFAULT 0,
    "configPath" TEXT NOT NULL,
    "statePath" TEXT NOT NULL,
    "workspacePath" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantGateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4-20250514',
    "agentName" TEXT NOT NULL DEFAULT 'Assistant',
    "systemPrompt" TEXT,
    "features" JSONB NOT NULL DEFAULT '{}',
    "maxTokensPerDay" INTEGER NOT NULL DEFAULT 50000,
    "maxConcurrentSessions" INTEGER NOT NULL DEFAULT 5,
    "maxMemoryMb" INTEGER NOT NULL DEFAULT 256,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "TenantCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantGateway_organizationId_key" ON "TenantGateway"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantGateway_port_key" ON "TenantGateway"("port");

-- CreateIndex
CREATE INDEX "TenantGateway_status_idx" ON "TenantGateway"("status");

-- CreateIndex
CREATE INDEX "TenantGateway_port_idx" ON "TenantGateway"("port");

-- CreateIndex
CREATE UNIQUE INDEX "TenantConfig_organizationId_key" ON "TenantConfig"("organizationId");

-- CreateIndex
CREATE INDEX "TenantCredential_organizationId_idx" ON "TenantCredential"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantCredential_organizationId_key_key" ON "TenantCredential"("organizationId", "key");

-- AddForeignKey
ALTER TABLE "TenantGateway" ADD CONSTRAINT "TenantGateway_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantConfig" ADD CONSTRAINT "TenantConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCredential" ADD CONSTRAINT "TenantCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
