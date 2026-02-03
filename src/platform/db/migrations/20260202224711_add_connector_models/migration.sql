-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('SQL_SERVER', 'POSTGRESQL', 'MYSQL', 'DATAVERSE', 'SALESFORCE');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'ERROR', 'DISABLED');

-- CreateTable
CREATE TABLE "ResourceConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ConnectionType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "credentials" TEXT,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "lastHealthCheck" TIMESTAMP(3),
    "healthMessage" TEXT,
    "isReadOnly" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ResourceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemaHint" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "columnName" TEXT,
    "description" TEXT NOT NULL,
    "pattern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "SchemaHint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemaCache" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "tables" JSONB NOT NULL,
    "relationships" JSONB,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemaCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResourceConnection_organizationId_type_idx" ON "ResourceConnection"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceConnection_organizationId_name_key" ON "ResourceConnection"("organizationId", "name");

-- CreateIndex
CREATE INDEX "SchemaHint_connectionId_idx" ON "SchemaHint"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SchemaHint_connectionId_tableName_description_key" ON "SchemaHint"("connectionId", "tableName", "description");

-- CreateIndex
CREATE UNIQUE INDEX "SchemaCache_connectionId_key" ON "SchemaCache"("connectionId");

-- AddForeignKey
ALTER TABLE "ResourceConnection" ADD CONSTRAINT "ResourceConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaHint" ADD CONSTRAINT "SchemaHint_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ResourceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaCache" ADD CONSTRAINT "SchemaCache_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ResourceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
