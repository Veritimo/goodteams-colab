#!/usr/bin/env tsx
/**
 * Seed Test Data Script for GoodTeams Platform
 *
 * Creates realistic test data using Prisma client directly:
 * - 2-3 organizations with different statuses
 * - Users with different roles (admin, user, billing, viewer)
 * - Sample workflows with different node types
 * - Workflow executions with logs
 *
 * Run: pnpm tsx scripts/seed-test-data.ts
 *      or: pnpm db:seed (if this is set as seed script)
 *
 * Prerequisites:
 *   - DATABASE_URL environment variable set
 *   - Database migrations applied (pnpm db:migrate)
 *
 * This script is idempotent - can be run multiple times safely.
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

// =============================================================================
// SEED DATA DEFINITIONS
// =============================================================================

// Stable IDs for idempotent seeding
const IDS = {
  orgs: {
    acme: "seed-org-acme-corp-001",
    techstart: "seed-org-techstart-002",
    enterprise: "seed-org-enterprise-003",
  },
  users: {
    // Acme Corp users
    acmeAdmin: "seed-user-acme-admin-001",
    acmeUser1: "seed-user-acme-user1-002",
    acmeUser2: "seed-user-acme-user2-003",
    acmeViewer: "seed-user-acme-viewer-004",
    acmeBilling: "seed-user-acme-billing-005",
    // TechStart users
    techAdmin: "seed-user-tech-admin-001",
    techUser: "seed-user-tech-user-002",
    // Enterprise users
    entAdmin: "seed-user-ent-admin-001",
    entSuperAdmin: "seed-user-ent-super-001",
  },
  workflows: {
    // Acme workflows
    customerOnboard: "seed-wf-customer-onboard-001",
    dataSync: "seed-wf-data-sync-002",
    reportGen: "seed-wf-report-gen-003",
    alertHandler: "seed-wf-alert-handler-004",
    emailCampaign: "seed-wf-email-campaign-005",
    // TechStart workflows
    devDeploy: "seed-wf-dev-deploy-001",
    codeReview: "seed-wf-code-review-002",
  },
};

// =============================================================================
// ORGANIZATION DATA
// =============================================================================

const organizations = [
  {
    id: IDS.orgs.acme,
    name: "Acme Corporation",
    status: "ACTIVE" as const,
    externalTenantId: "acme-tenant-001",
    authorizedModels: ["anthropic/claude-sonnet-4-20250514", "openai/gpt-4o"],
    defaultModelId: "anthropic/claude-sonnet-4-20250514",
  },
  {
    id: IDS.orgs.techstart,
    name: "TechStart Inc",
    status: "ACTIVE" as const,
    externalTenantId: "techstart-tenant-002",
    authorizedModels: ["anthropic/claude-sonnet-4-20250514"],
    defaultModelId: "anthropic/claude-sonnet-4-20250514",
  },
  {
    id: IDS.orgs.enterprise,
    name: "Enterprise Global Ltd",
    status: "PENDING" as const,
    externalTenantId: null, // Awaiting Entra connection
    authorizedModels: [],
    defaultModelId: null,
  },
];

// =============================================================================
// USER DATA
// =============================================================================

const users = [
  // Acme Corporation users
  {
    id: IDS.users.acmeAdmin,
    email: "admin@acme-corp.test",
    username: "Sarah Admin",
    role: "ADMIN" as const,
    organizationId: IDS.orgs.acme,
    externalId: "entra-sarah-001",
  },
  {
    id: IDS.users.acmeUser1,
    email: "john.doe@acme-corp.test",
    username: "John Doe",
    role: "USER" as const,
    organizationId: IDS.orgs.acme,
    externalId: "entra-john-002",
  },
  {
    id: IDS.users.acmeUser2,
    email: "jane.smith@acme-corp.test",
    username: "Jane Smith",
    role: "USER" as const,
    organizationId: IDS.orgs.acme,
    externalId: "entra-jane-003",
  },
  {
    id: IDS.users.acmeViewer,
    email: "viewer@acme-corp.test",
    username: "View Only",
    role: "VIEWER" as const,
    organizationId: IDS.orgs.acme,
    externalId: "entra-viewer-004",
  },
  {
    id: IDS.users.acmeBilling,
    email: "billing@acme-corp.test",
    username: "Billing Admin",
    role: "BILLING" as const,
    organizationId: IDS.orgs.acme,
    externalId: "entra-billing-005",
  },
  // TechStart users
  {
    id: IDS.users.techAdmin,
    email: "admin@techstart.test",
    username: "Tech Admin",
    role: "ADMIN" as const,
    organizationId: IDS.orgs.techstart,
    externalId: "entra-techadmin-001",
  },
  {
    id: IDS.users.techUser,
    email: "dev@techstart.test",
    username: "Dev User",
    role: "USER" as const,
    organizationId: IDS.orgs.techstart,
    externalId: "entra-techdev-002",
  },
  // Enterprise users (pending org)
  {
    id: IDS.users.entAdmin,
    email: "admin@enterprise-global.test",
    username: "Enterprise Admin",
    role: "ADMIN" as const,
    organizationId: IDS.orgs.enterprise,
    externalId: null, // No SSO yet
  },
  {
    id: IDS.users.entSuperAdmin,
    email: "superadmin@goodteams.ai",
    username: "Platform Super Admin",
    role: "SUPER_ADMIN" as const,
    organizationId: IDS.orgs.enterprise,
    externalId: "platform-super-001",
  },
];

// =============================================================================
// WORKFLOW DEFINITIONS
// =============================================================================

const workflows = [
  // Customer Onboarding Workflow
  {
    id: IDS.workflows.customerOnboard,
    organizationId: IDS.orgs.acme,
    name: "Customer Onboarding",
    description: "Automated customer onboarding process with email notifications",
    status: "ACTIVE" as const,
    triggerType: "WEBHOOK" as const,
    triggerConfig: {
      webhookPath: "customer-signup",
      validateSignature: true,
    },
    createdBy: IDS.users.acmeAdmin,
    definition: {
      nodes: [
        { id: "start", type: "START", config: {}, position: { x: 0, y: 100 } },
        {
          id: "validate",
          type: "CONDITION",
          config: {
            condition: "inputs.email && inputs.name",
            label: "Validate Input",
          },
          position: { x: 200, y: 100 },
        },
        {
          id: "createAccount",
          type: "AI_TASK",
          config: {
            prompt: "Create a welcome message for new customer: {{inputs.name}}",
            model: "anthropic/claude-sonnet-4-20250514",
          },
          position: { x: 400, y: 50 },
        },
        {
          id: "sendEmail",
          type: "HTTP",
          config: {
            method: "POST",
            url: "https://api.sendgrid.com/v3/mail/send",
            body: { to: "{{inputs.email}}", content: "{{nodes.createAccount.output}}" },
          },
          position: { x: 600, y: 50 },
        },
        {
          id: "logFailure",
          type: "LOG",
          config: { level: "error", message: "Invalid customer data received" },
          position: { x: 400, y: 150 },
        },
        { id: "end", type: "END", config: {}, position: { x: 800, y: 100 } },
      ],
      edges: [
        { source: "start", target: "validate" },
        { source: "validate", target: "createAccount", condition: "true" },
        { source: "validate", target: "logFailure", condition: "false" },
        { source: "createAccount", target: "sendEmail" },
        { source: "sendEmail", target: "end" },
        { source: "logFailure", target: "end" },
      ],
      globalConfig: {
        timeout: 300000,
        retryPolicy: { maxRetries: 3, backoffMs: 1000 },
      },
    },
  },
  // Data Sync Workflow
  {
    id: IDS.workflows.dataSync,
    organizationId: IDS.orgs.acme,
    name: "Salesforce Data Sync",
    description: "Periodic sync of Salesforce data to internal database",
    status: "ACTIVE" as const,
    triggerType: "CRON" as const,
    triggerConfig: {
      cronExpression: "0 0 * * *", // Daily at midnight
    },
    createdBy: IDS.users.acmeAdmin,
    definition: {
      nodes: [
        { id: "start", type: "START", config: {}, position: { x: 0, y: 100 } },
        {
          id: "fetchSalesforce",
          type: "HTTP",
          config: {
            method: "GET",
            url: "https://api.salesforce.com/data/v58.0/query",
            headers: { Authorization: "Bearer {{secrets.SALESFORCE_TOKEN}}" },
          },
          position: { x: 200, y: 100 },
        },
        {
          id: "transform",
          type: "AI_TASK",
          config: {
            prompt: "Transform and clean the following sales data for database insertion: {{nodes.fetchSalesforce.output}}",
            model: "anthropic/claude-sonnet-4-20250514",
          },
          position: { x: 400, y: 100 },
        },
        {
          id: "insertDB",
          type: "SQL",
          config: {
            connectionId: "salesforce-mirror",
            query: "INSERT INTO sales_data VALUES ({{nodes.transform.output}})",
          },
          position: { x: 600, y: 100 },
        },
        { id: "end", type: "END", config: {}, position: { x: 800, y: 100 } },
      ],
      edges: [
        { source: "start", target: "fetchSalesforce" },
        { source: "fetchSalesforce", target: "transform" },
        { source: "transform", target: "insertDB" },
        { source: "insertDB", target: "end" },
      ],
    },
  },
  // Report Generation Workflow
  {
    id: IDS.workflows.reportGen,
    organizationId: IDS.orgs.acme,
    name: "Weekly Sales Report",
    description: "Generate and distribute weekly sales reports",
    status: "ACTIVE" as const,
    triggerType: "CRON" as const,
    triggerConfig: {
      cronExpression: "0 9 * * 1", // Monday at 9am
    },
    createdBy: IDS.users.acmeUser1,
    definition: {
      nodes: [
        { id: "start", type: "START", config: {}, position: { x: 0, y: 100 } },
        {
          id: "fetchData",
          type: "SQL",
          config: {
            connectionId: "main-db",
            query: "SELECT * FROM sales WHERE week = CURRENT_WEEK",
          },
          position: { x: 200, y: 100 },
        },
        {
          id: "generateReport",
          type: "AI_TASK",
          config: {
            prompt: "Generate a professional sales report summary with insights and recommendations based on: {{nodes.fetchData.output}}",
            model: "anthropic/claude-sonnet-4-20250514",
          },
          position: { x: 400, y: 100 },
        },
        {
          id: "sendReport",
          type: "EMAIL",
          config: {
            to: ["sales-team@acme-corp.test", "management@acme-corp.test"],
            subject: "Weekly Sales Report - {{now | date: '%Y-%m-%d'}}",
            body: "{{nodes.generateReport.output}}",
          },
          position: { x: 600, y: 100 },
        },
        { id: "end", type: "END", config: {}, position: { x: 800, y: 100 } },
      ],
      edges: [
        { source: "start", target: "fetchData" },
        { source: "fetchData", target: "generateReport" },
        { source: "generateReport", target: "sendReport" },
        { source: "sendReport", target: "end" },
      ],
    },
  },
  // Alert Handler Workflow
  {
    id: IDS.workflows.alertHandler,
    organizationId: IDS.orgs.acme,
    name: "Critical Alert Handler",
    description: "Handle critical system alerts with AI triage",
    status: "ACTIVE" as const,
    triggerType: "WEBHOOK" as const,
    triggerConfig: {
      webhookPath: "alerts",
    },
    createdBy: IDS.users.acmeAdmin,
    definition: {
      nodes: [
        { id: "start", type: "START", config: {}, position: { x: 0, y: 100 } },
        {
          id: "triage",
          type: "AI_TASK",
          config: {
            prompt: "Analyze this alert and determine severity (1-5) and recommended action: {{inputs}}",
            model: "anthropic/claude-sonnet-4-20250514",
          },
          position: { x: 200, y: 100 },
        },
        {
          id: "checkSeverity",
          type: "CONDITION",
          config: {
            condition: "nodes.triage.output.severity >= 4",
          },
          position: { x: 400, y: 100 },
        },
        {
          id: "pageOncall",
          type: "HTTP",
          config: {
            method: "POST",
            url: "https://api.pagerduty.com/incidents",
          },
          position: { x: 600, y: 50 },
        },
        {
          id: "logAlert",
          type: "LOG",
          config: { level: "warn", message: "Alert logged: {{inputs}}" },
          position: { x: 600, y: 150 },
        },
        { id: "end", type: "END", config: {}, position: { x: 800, y: 100 } },
      ],
      edges: [
        { source: "start", target: "triage" },
        { source: "triage", target: "checkSeverity" },
        { source: "checkSeverity", target: "pageOncall", condition: "true" },
        { source: "checkSeverity", target: "logAlert", condition: "false" },
        { source: "pageOncall", target: "end" },
        { source: "logAlert", target: "end" },
      ],
    },
  },
  // Email Campaign Workflow (Draft)
  {
    id: IDS.workflows.emailCampaign,
    organizationId: IDS.orgs.acme,
    name: "Email Marketing Campaign",
    description: "Draft workflow for email marketing campaigns",
    status: "DRAFT" as const,
    triggerType: "MANUAL" as const,
    triggerConfig: null,
    createdBy: IDS.users.acmeUser2,
    definition: {
      nodes: [
        { id: "start", type: "START", config: {}, position: { x: 0, y: 100 } },
        {
          id: "generateContent",
          type: "AI_TASK",
          config: {
            prompt: "Generate marketing email content for: {{inputs.campaign}}",
            model: "anthropic/claude-sonnet-4-20250514",
          },
          position: { x: 200, y: 100 },
        },
        { id: "end", type: "END", config: {}, position: { x: 400, y: 100 } },
      ],
      edges: [
        { source: "start", target: "generateContent" },
        { source: "generateContent", target: "end" },
      ],
    },
  },
  // TechStart - Deployment Workflow
  {
    id: IDS.workflows.devDeploy,
    organizationId: IDS.orgs.techstart,
    name: "Development Deployment",
    description: "Automated deployment pipeline with AI code review",
    status: "ACTIVE" as const,
    triggerType: "WEBHOOK" as const,
    triggerConfig: {
      webhookPath: "github-deploy",
    },
    createdBy: IDS.users.techAdmin,
    definition: {
      nodes: [
        { id: "start", type: "START", config: {}, position: { x: 0, y: 100 } },
        {
          id: "codeReview",
          type: "AI_TASK",
          config: {
            prompt: "Review this code diff for potential issues: {{inputs.diff}}",
            model: "anthropic/claude-sonnet-4-20250514",
          },
          position: { x: 200, y: 100 },
        },
        {
          id: "runTests",
          type: "HTTP",
          config: {
            method: "POST",
            url: "{{env.CI_SERVER}}/run-tests",
          },
          position: { x: 400, y: 100 },
        },
        {
          id: "deploy",
          type: "HTTP",
          config: {
            method: "POST",
            url: "{{env.DEPLOY_SERVER}}/deploy",
          },
          position: { x: 600, y: 100 },
        },
        { id: "end", type: "END", config: {}, position: { x: 800, y: 100 } },
      ],
      edges: [
        { source: "start", target: "codeReview" },
        { source: "codeReview", target: "runTests" },
        { source: "runTests", target: "deploy" },
        { source: "deploy", target: "end" },
      ],
    },
  },
  // TechStart - Code Review Workflow (Paused)
  {
    id: IDS.workflows.codeReview,
    organizationId: IDS.orgs.techstart,
    name: "AI Code Review",
    description: "Automated code review for pull requests",
    status: "PAUSED" as const,
    triggerType: "WEBHOOK" as const,
    triggerConfig: {
      webhookPath: "github-pr",
    },
    createdBy: IDS.users.techUser,
    definition: {
      nodes: [
        { id: "start", type: "START", config: {}, position: { x: 0, y: 100 } },
        {
          id: "review",
          type: "AI_TASK",
          config: {
            prompt: "Perform a thorough code review: {{inputs}}",
            model: "anthropic/claude-sonnet-4-20250514",
          },
          position: { x: 200, y: 100 },
        },
        { id: "end", type: "END", config: {}, position: { x: 400, y: 100 } },
      ],
      edges: [
        { source: "start", target: "review" },
        { source: "review", target: "end" },
      ],
    },
  },
];

// =============================================================================
// WORKFLOW EXECUTIONS
// =============================================================================

interface ExecutionSeed {
  workflowId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "WAITING_FOR_INPUT";
  context: Record<string, unknown>;
  logs: Array<{
    timestamp: string;
    nodeId: string | null;
    message: string;
    level: string;
    data?: Record<string, unknown>;
  }>;
  triggeredBy: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
}

function generateExecutions(): ExecutionSeed[] {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return [
    // Completed customer onboarding
    {
      workflowId: IDS.workflows.customerOnboard,
      status: "COMPLETED",
      context: {
        inputs: { email: "newcustomer@example.com", name: "New Customer" },
        nodeOutputs: {
          validate: { result: true },
          createAccount: { output: "Welcome to Acme Corp, New Customer!" },
          sendEmail: { statusCode: 200 },
        },
      },
      logs: [
        { timestamp: dayAgo.toISOString(), nodeId: "start", message: "Workflow started", level: "info" },
        { timestamp: new Date(dayAgo.getTime() + 100).toISOString(), nodeId: "validate", message: "Input validated successfully", level: "info" },
        { timestamp: new Date(dayAgo.getTime() + 2000).toISOString(), nodeId: "createAccount", message: "AI task completed", level: "info" },
        { timestamp: new Date(dayAgo.getTime() + 3000).toISOString(), nodeId: "sendEmail", message: "Email sent successfully", level: "info" },
        { timestamp: new Date(dayAgo.getTime() + 3100).toISOString(), nodeId: "end", message: "Workflow completed", level: "info" },
      ],
      triggeredBy: "webhook",
      startedAt: dayAgo,
      finishedAt: new Date(dayAgo.getTime() + 3100),
      error: null,
    },
    // Failed customer onboarding
    {
      workflowId: IDS.workflows.customerOnboard,
      status: "FAILED",
      context: {
        inputs: { email: "", name: "" },
        nodeOutputs: {
          validate: { result: false },
        },
      },
      logs: [
        { timestamp: weekAgo.toISOString(), nodeId: "start", message: "Workflow started", level: "info" },
        { timestamp: new Date(weekAgo.getTime() + 100).toISOString(), nodeId: "validate", message: "Validation failed: missing email and name", level: "error" },
        { timestamp: new Date(weekAgo.getTime() + 200).toISOString(), nodeId: "logFailure", message: "Invalid customer data received", level: "error" },
      ],
      triggeredBy: "webhook",
      startedAt: weekAgo,
      finishedAt: new Date(weekAgo.getTime() + 300),
      error: "Validation failed: missing required fields",
    },
    // Running data sync
    {
      workflowId: IDS.workflows.dataSync,
      status: "RUNNING",
      context: {
        inputs: {},
        nodeOutputs: {
          fetchSalesforce: { records: 150 },
        },
      },
      logs: [
        { timestamp: hourAgo.toISOString(), nodeId: "start", message: "Daily sync started", level: "info" },
        { timestamp: new Date(hourAgo.getTime() + 5000).toISOString(), nodeId: "fetchSalesforce", message: "Fetched 150 records from Salesforce", level: "info" },
        { timestamp: new Date(hourAgo.getTime() + 10000).toISOString(), nodeId: "transform", message: "Transforming data...", level: "info" },
      ],
      triggeredBy: "cron",
      startedAt: hourAgo,
      finishedAt: null,
      error: null,
    },
    // Completed report generation
    {
      workflowId: IDS.workflows.reportGen,
      status: "COMPLETED",
      context: {
        inputs: {},
        nodeOutputs: {
          fetchData: { totalSales: 125000, dealsClosed: 23 },
          generateReport: { summary: "Strong week with 23 deals..." },
          sendReport: { sent: true },
        },
      },
      logs: [
        { timestamp: weekAgo.toISOString(), nodeId: "start", message: "Weekly report generation started", level: "info" },
        { timestamp: new Date(weekAgo.getTime() + 1000).toISOString(), nodeId: "fetchData", message: "Retrieved sales data", level: "info" },
        { timestamp: new Date(weekAgo.getTime() + 5000).toISOString(), nodeId: "generateReport", message: "Report generated successfully", level: "info" },
        { timestamp: new Date(weekAgo.getTime() + 6000).toISOString(), nodeId: "sendReport", message: "Report sent to 2 recipients", level: "info" },
        { timestamp: new Date(weekAgo.getTime() + 6100).toISOString(), nodeId: "end", message: "Workflow completed", level: "info" },
      ],
      triggeredBy: "cron",
      startedAt: weekAgo,
      finishedAt: new Date(weekAgo.getTime() + 6100),
      error: null,
    },
    // Alert handling
    {
      workflowId: IDS.workflows.alertHandler,
      status: "COMPLETED",
      context: {
        inputs: { alertType: "CPU_HIGH", server: "prod-api-1", value: 95 },
        nodeOutputs: {
          triage: { severity: 4, action: "Page on-call engineer" },
          pageOncall: { incidentId: "INC-001234" },
        },
      },
      logs: [
        { timestamp: hourAgo.toISOString(), nodeId: "start", message: "Alert received", level: "info" },
        { timestamp: new Date(hourAgo.getTime() + 500).toISOString(), nodeId: "triage", message: "Alert triaged: severity 4", level: "warn" },
        { timestamp: new Date(hourAgo.getTime() + 1000).toISOString(), nodeId: "pageOncall", message: "On-call paged successfully", level: "info" },
      ],
      triggeredBy: "webhook",
      startedAt: hourAgo,
      finishedAt: new Date(hourAgo.getTime() + 1100),
      error: null,
    },
    // TechStart deployment
    {
      workflowId: IDS.workflows.devDeploy,
      status: "COMPLETED",
      context: {
        inputs: { repo: "techstart/main-app", branch: "main", commit: "abc123" },
        nodeOutputs: {
          codeReview: { issues: 0, suggestions: 2 },
          runTests: { passed: 142, failed: 0 },
          deploy: { version: "v2.3.1", environment: "production" },
        },
      },
      logs: [
        { timestamp: dayAgo.toISOString(), nodeId: "start", message: "Deployment triggered", level: "info" },
        { timestamp: new Date(dayAgo.getTime() + 2000).toISOString(), nodeId: "codeReview", message: "Code review passed with 2 suggestions", level: "info" },
        { timestamp: new Date(dayAgo.getTime() + 30000).toISOString(), nodeId: "runTests", message: "All 142 tests passed", level: "info" },
        { timestamp: new Date(dayAgo.getTime() + 60000).toISOString(), nodeId: "deploy", message: "Deployed v2.3.1 to production", level: "info" },
      ],
      triggeredBy: IDS.users.techAdmin,
      startedAt: dayAgo,
      finishedAt: new Date(dayAgo.getTime() + 60100),
      error: null,
    },
  ];
}

// =============================================================================
// SEEDING FUNCTIONS
// =============================================================================

async function seedOrganizations(): Promise<void> {
  console.log("\n📁 Seeding organizations...");

  for (const org of organizations) {
    await prisma.organization.upsert({
      where: { id: org.id },
      update: {
        name: org.name,
        status: org.status,
        externalTenantId: org.externalTenantId,
        authorizedModels: org.authorizedModels,
        defaultModelId: org.defaultModelId,
      },
      create: org,
    });
    console.log(`  ✓ ${org.name} (${org.status})`);
  }
}

async function seedUsers(): Promise<void> {
  console.log("\n👤 Seeding users...");

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        username: user.username,
        role: user.role,
        organizationId: user.organizationId,
        externalId: user.externalId,
      },
      create: user,
    });
    console.log(`  ✓ ${user.username} (${user.role}) - ${user.email}`);
  }
}

async function seedWorkflows(): Promise<void> {
  console.log("\n🔄 Seeding workflows...");

  for (const workflow of workflows) {
    await prisma.workflow.upsert({
      where: { id: workflow.id },
      update: {
        name: workflow.name,
        description: workflow.description,
        definition: workflow.definition,
        status: workflow.status,
        triggerType: workflow.triggerType,
        triggerConfig: workflow.triggerConfig,
      },
      create: workflow,
    });
    console.log(`  ✓ ${workflow.name} (${workflow.status}) - ${workflow.triggerType || "No trigger"}`);
  }
}

async function seedExecutions(): Promise<void> {
  console.log("\n⚡ Seeding workflow executions...");

  const executions = generateExecutions();

  // Delete existing seed executions (those older than 2 weeks are assumed seeded)
  // This allows re-running without duplicate executions
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  await prisma.workflowExecution.deleteMany({
    where: {
      startedAt: { lt: twoWeeksAgo },
      workflowId: { in: Object.values(IDS.workflows) },
    },
  });

  for (const execution of executions) {
    const created = await prisma.workflowExecution.create({
      data: {
        workflowId: execution.workflowId,
        status: execution.status,
        context: execution.context,
        logs: execution.logs,
        triggeredBy: execution.triggeredBy,
        startedAt: execution.startedAt,
        finishedAt: execution.finishedAt,
        error: execution.error,
      },
    });
    console.log(`  ✓ Execution ${created.id.slice(0, 8)}... (${execution.status})`);
  }
}

async function seedTenantConfigs(): Promise<void> {
  console.log("\n⚙️  Seeding tenant configurations...");

  const configs = [
    {
      organizationId: IDS.orgs.acme,
      model: "anthropic/claude-sonnet-4-20250514",
      agentName: "Acme Assistant",
      systemPrompt: "You are a helpful assistant for Acme Corporation employees.",
      features: { codeExecution: true, webBrowsing: true },
      maxTokensPerDay: 100000,
      maxConcurrentSessions: 10,
      maxMemoryMb: 512,
    },
    {
      organizationId: IDS.orgs.techstart,
      model: "anthropic/claude-sonnet-4-20250514",
      agentName: "TechBot",
      systemPrompt: "You are a developer-focused assistant for TechStart Inc.",
      features: { codeExecution: true, webBrowsing: false },
      maxTokensPerDay: 50000,
      maxConcurrentSessions: 5,
      maxMemoryMb: 256,
    },
  ];

  for (const config of configs) {
    await prisma.tenantConfig.upsert({
      where: { organizationId: config.organizationId },
      update: config,
      create: {
        id: randomUUID(),
        ...config,
      },
    });
    console.log(`  ✓ Config for org ${config.organizationId.slice(0, 20)}...`);
  }
}

async function seedAuditLogs(): Promise<void> {
  console.log("\n📝 Seeding sample audit logs...");

  const auditLogs = [
    {
      organizationId: IDS.orgs.acme,
      actorId: IDS.users.acmeAdmin,
      actorRole: "ADMIN" as const,
      action: "user.role.changed",
      targetType: "user",
      targetId: IDS.users.acmeUser1,
      details: { oldRole: "VIEWER", newRole: "USER" },
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0",
    },
    {
      organizationId: IDS.orgs.acme,
      actorId: IDS.users.acmeAdmin,
      actorRole: "ADMIN" as const,
      action: "workflow.created",
      targetType: "workflow",
      targetId: IDS.workflows.customerOnboard,
      details: { name: "Customer Onboarding" },
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0",
    },
    {
      organizationId: IDS.orgs.techstart,
      actorId: IDS.users.techAdmin,
      actorRole: "ADMIN" as const,
      action: "organization.settings.updated",
      targetType: "organization",
      targetId: IDS.orgs.techstart,
      details: { changes: { defaultModelId: "anthropic/claude-sonnet-4-20250514" } },
      ipAddress: "10.0.0.50",
      userAgent: "Mozilla/5.0",
    },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({ data: log });
    console.log(`  ✓ ${log.action} by ${log.actorId.slice(0, 20)}...`);
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  GoodTeams Platform - Seed Test Data                          ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");

  try {
    // Seed in order of dependencies
    await seedOrganizations();
    await seedUsers();
    await seedTenantConfigs();
    await seedWorkflows();
    await seedExecutions();
    await seedAuditLogs();

    console.log("\n╔═══════════════════════════════════════════════════════════════╗");
    console.log("║  ✅ Seed completed successfully!                              ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝");

    console.log("\n📊 Summary:");
    console.log(`   Organizations: ${organizations.length}`);
    console.log(`   Users: ${users.length}`);
    console.log(`   Workflows: ${workflows.length}`);
    console.log(`   Executions: ${generateExecutions().length}`);

    console.log("\n🔑 Test credentials (stub auth format):");
    console.log("   Admin: admin@acme-corp.test (Acme Corp)");
    console.log("   User:  john.doe@acme-corp.test (Acme Corp)");
    console.log("   Admin: admin@techstart.test (TechStart Inc)");

  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
