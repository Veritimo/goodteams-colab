/**
 * Test M365 API integrations with real tokens
 */
import { getValidAccessToken } from "../src/platform/auth/entra/token-store.js";
import { prisma } from "../src/platform/db/client.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function testM365() {
  // Find the user we just logged in
  const user = await prisma.user.findFirst({
    where: { email: "djhyman@veritimo.com" },
  });

  if (!user) {
    console.log("❌ User not found. Did you complete SSO login?");
    return;
  }

  console.log(`\n👤 User: ${user.email} (${user.id})\n`);

  // Get the Microsoft access token
  const accessToken = await getValidAccessToken(user.id, ["User.Read"]);
  
  if (!accessToken) {
    console.log("❌ No valid access token. Try logging in again.");
    return;
  }

  console.log("✅ Got valid Microsoft access token\n");

  // Helper to call Graph API
  async function callGraph(endpoint: string, name: string) {
    try {
      const res = await fetch(`${GRAPH_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`✅ ${name}:`, JSON.stringify(data, null, 2).slice(0, 500) + "...");
      } else {
        console.log(`❌ ${name}:`, data.error?.message || res.status);
      }
    } catch (e: any) {
      console.log(`❌ ${name}:`, e.message);
    }
    console.log("");
  }

  // Test various M365 APIs
  console.log("=== Testing Microsoft Graph APIs ===\n");

  // Profile
  await callGraph("/me", "Profile (/me)");
  
  // OneDrive (personal drive)
  await callGraph("/me/drive/root/children?$top=5", "OneDrive Files");
  
  // SharePoint
  console.log("--- SharePoint ---");
  await callGraph("/sites?search=*", "SharePoint Sites (search)");
  await callGraph("/sites/root", "SharePoint Root Site");
  
  // Get first site and list its drives/lists
  try {
    const sitesRes = await fetch(`${GRAPH_BASE}/sites?search=*&$top=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const sitesData = await sitesRes.json();
    if (sitesData.value && sitesData.value.length > 0) {
      const siteId = sitesData.value[0].id;
      console.log(`   Found site: ${sitesData.value[0].displayName} (${siteId})\n`);
      await callGraph(`/sites/${siteId}/drives`, "SharePoint Document Libraries");
      await callGraph(`/sites/${siteId}/lists?$top=5`, "SharePoint Lists");
    }
  } catch (e: any) {
    console.log("   Could not enumerate SharePoint site details:", e.message);
  }
  
  // Outlook
  console.log("--- Outlook ---");
  await callGraph("/me/messages?$top=3", "Outlook Messages");
  await callGraph("/me/events?$top=3", "Calendar Events");
  
  // Teams
  console.log("--- Teams ---");
  await callGraph("/me/joinedTeams", "Teams Memberships");

  await prisma.$disconnect();
}

testM365().catch(console.error);
