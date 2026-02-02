/**
 * Email Service Stub
 *
 * Stub implementation for sending emails.
 * Logs to console for development/testing.
 *
 * TODO: Integrate with a real email provider (SendGrid, Postmark, etc.)
 */

import type { UserRole } from "@prisma/client";

/**
 * Invitation data for email sending
 */
export interface InvitationEmailData {
  id: string;
  email: string;
  token: string;
  role: UserRole;
  expiresAt: Date;
}

/**
 * Send invitation email
 *
 * STUB: Logs to console for now.
 * Production implementation should send actual emails via SendGrid, Postmark, etc.
 *
 * @param invitation - Invitation data
 * @param orgName - Organization name
 * @param inviterEmail - Email of the person who sent the invitation
 */
export async function sendInvitationEmail(
  invitation: InvitationEmailData,
  orgName: string,
  inviterEmail: string,
): Promise<void> {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const acceptUrl = `${appUrl}/invitations/accept?token=${invitation.token}`;

  console.log("═".repeat(60));
  console.log("[EMAIL STUB] Sending invitation email");
  console.log("─".repeat(60));
  console.log(`  To:           ${invitation.email}`);
  console.log(`  Organization: ${orgName}`);
  console.log(`  Role:         ${invitation.role}`);
  console.log(`  Invited by:   ${inviterEmail}`);
  console.log(`  Expires:      ${invitation.expiresAt.toISOString()}`);
  console.log("─".repeat(60));
  console.log(`  Accept URL:   ${acceptUrl}`);
  console.log("═".repeat(60));

  // In a real implementation, you would call your email provider here:
  //
  // await emailProvider.send({
  //   to: invitation.email,
  //   template: "organization-invitation",
  //   data: {
  //     orgName,
  //     inviterEmail,
  //     role: invitation.role,
  //     acceptUrl,
  //     expiresAt: invitation.expiresAt,
  //   },
  // });
}

/**
 * Send password reset email
 *
 * STUB: Logs to console for now.
 */
export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/auth/reset-password?token=${resetToken}`;

  console.log("═".repeat(60));
  console.log("[EMAIL STUB] Sending password reset email");
  console.log("─".repeat(60));
  console.log(`  To:         ${email}`);
  console.log(`  Reset URL:  ${resetUrl}`);
  console.log("═".repeat(60));
}

/**
 * Send welcome email after user joins organization
 *
 * STUB: Logs to console for now.
 */
export async function sendWelcomeEmail(
  email: string,
  orgName: string,
  role: UserRole,
): Promise<void> {
  console.log("═".repeat(60));
  console.log("[EMAIL STUB] Sending welcome email");
  console.log("─".repeat(60));
  console.log(`  To:           ${email}`);
  console.log(`  Organization: ${orgName}`);
  console.log(`  Role:         ${role}`);
  console.log("═".repeat(60));
}

/**
 * Send notification when user role is changed
 *
 * STUB: Logs to console for now.
 */
export async function sendRoleChangeEmail(
  email: string,
  orgName: string,
  oldRole: UserRole,
  newRole: UserRole,
  changedByEmail: string,
): Promise<void> {
  console.log("═".repeat(60));
  console.log("[EMAIL STUB] Sending role change notification");
  console.log("─".repeat(60));
  console.log(`  To:           ${email}`);
  console.log(`  Organization: ${orgName}`);
  console.log(`  Old Role:     ${oldRole}`);
  console.log(`  New Role:     ${newRole}`);
  console.log(`  Changed by:   ${changedByEmail}`);
  console.log("═".repeat(60));
}

/**
 * Send notification when user is removed from organization
 *
 * STUB: Logs to console for now.
 */
export async function sendRemovalEmail(
  email: string,
  orgName: string,
  removedByEmail: string,
): Promise<void> {
  console.log("═".repeat(60));
  console.log("[EMAIL STUB] Sending removal notification");
  console.log("─".repeat(60));
  console.log(`  To:           ${email}`);
  console.log(`  Organization: ${orgName}`);
  console.log(`  Removed by:   ${removedByEmail}`);
  console.log("═".repeat(60));
}
