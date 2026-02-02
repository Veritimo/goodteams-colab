/**
 * Database Seed Script
 *
 * Populates the database with development/test data.
 *
 * Run with: pnpm db:seed
 * Or automatically via: prisma db seed
 */

import { PrismaClient, UserRole, OrgStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data (in reverse order of dependencies)
  console.log("  Cleaning existing data...");
  await prisma.auditLog.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.organizationSkill.deleteMany();
  await prisma.organizationInvitation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Create demo organization
  console.log("  Creating demo organization...");
  const demoOrg = await prisma.organization.create({
    data: {
      name: "GoodTeams Demo",
      status: OrgStatus.ACTIVE,
      authorizedModels: JSON.stringify([
        "anthropic/claude-sonnet-4",
        "anthropic/claude-opus-4",
        "openai/gpt-4o",
      ]),
      defaultModelId: "anthropic/claude-sonnet-4",
    },
  });

  // Create admin user
  console.log("  Creating admin user...");
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@goodteams.ai",
      username: "admin",
      role: UserRole.ADMIN,
      organizationId: demoOrg.id,
    },
  });

  // Create regular user
  console.log("  Creating regular user...");
  const regularUser = await prisma.user.create({
    data: {
      email: "user@goodteams.ai",
      username: "user",
      role: UserRole.USER,
      organizationId: demoOrg.id,
    },
  });

  // Create viewer user
  console.log("  Creating viewer user...");
  await prisma.user.create({
    data: {
      email: "viewer@goodteams.ai",
      username: "viewer",
      role: UserRole.VIEWER,
      organizationId: demoOrg.id,
    },
  });

  // Create a pending invitation
  console.log("  Creating pending invitation...");
  await prisma.organizationInvitation.create({
    data: {
      email: "newuser@example.com",
      role: UserRole.USER,
      token: "demo-invite-token-12345",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      organizationId: demoOrg.id,
      issuerId: adminUser.id,
    },
  });

  // Grant explicit permission to regular user
  console.log("  Granting permissions...");
  await prisma.userPermission.create({
    data: {
      name: "SQL_EXECUTE",
      userId: regularUser.id,
      grantedBy: adminUser.id,
    },
  });

  // Install a demo skill
  console.log("  Installing demo skill...");
  await prisma.organizationSkill.create({
    data: {
      skillId: "sharepoint-search",
      name: "SharePoint Search",
      version: "1.0.0",
      isEnabled: true,
      config: JSON.stringify({
        siteUrl: "https://example.sharepoint.com",
        maxResults: 10,
      }),
      allowedRoles: JSON.stringify(["ADMIN", "USER"]),
      organizationId: demoOrg.id,
      installedBy: adminUser.id,
    },
  });

  // Create some audit log entries
  console.log("  Creating audit log entries...");
  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: demoOrg.id,
        actorId: adminUser.id,
        actorRole: UserRole.ADMIN,
        action: "organization.created",
        targetType: "organization",
        targetId: demoOrg.id,
        details: JSON.stringify({ name: demoOrg.name }),
      },
      {
        organizationId: demoOrg.id,
        actorId: adminUser.id,
        actorRole: UserRole.ADMIN,
        action: "user.created",
        targetType: "user",
        targetId: regularUser.id,
        details: JSON.stringify({ email: regularUser.email, role: regularUser.role }),
      },
      {
        organizationId: demoOrg.id,
        actorId: adminUser.id,
        actorRole: UserRole.ADMIN,
        action: "skill.installed",
        targetType: "skill",
        targetId: "sharepoint-search",
        details: JSON.stringify({ name: "SharePoint Search", version: "1.0.0" }),
      },
    ],
  });

  console.log("✅ Seed complete!");
  console.log("");
  console.log("Demo data created:");
  console.log(`  Organization: ${demoOrg.name} (${demoOrg.id})`);
  console.log(`  Admin user: ${adminUser.email}`);
  console.log(`  Regular user: ${regularUser.email}`);
  console.log(`  Pending invitation for: newuser@example.com`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
