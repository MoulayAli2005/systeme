import "dotenv/config";
import { prisma } from "../server/db";
import { syncAllOrganizations } from "../server/org/bootstrap";

/**
 * Deploy step: pushes new permissions and status transitions into existing
 * workspaces. Safe to run repeatedly.
 */
async function main() {
  const result = await syncAllOrganizations();
  console.log(`Synced roles, permissions and statuses for ${result.organizations} organization(s).`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
