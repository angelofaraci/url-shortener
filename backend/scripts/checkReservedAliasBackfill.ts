// Pre-deploy check (design D7 / task 2.3, re-run for task 7.4 before applying
// the edge-routing rules): confirms no existing Link.code already collides
// with a reserved alias. A collision would make that link unreachable once
// the edge starts routing the reserved path to the frontend SPA instead of
// the backend redirect handler.
//
// Run with: cd backend && npx tsx scripts/checkReservedAliasBackfill.ts
//
// Manual-conflict resolution if any codes are found: rename the conflicting
// Link.code (update the DB row directly, coordinate with the owning user if
// known) before applying k8s/ingress.yaml or terraform/frontend-cdn.tf.
import { PrismaClient } from '@prisma/client';

// Keep in sync with RESERVED_ALIASES in src/controllers/linkController.ts.
const RESERVED_ALIASES = ['assets', 'index.html', 'link-error', 'stats', 'links', 'dashboard', 'api', 'auth', 'health'];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const conflicts = await prisma.link.findMany({
      where: { code: { in: RESERVED_ALIASES } },
      select: { id: true, code: true, userId: true, createdAt: true },
    });

    if (conflicts.length === 0) {
      console.log('No reserved-alias conflicts found. Safe to apply edge-routing rules.');
      return;
    }

    console.error(`Found ${conflicts.length} conflicting link(s) using reserved codes:`);
    for (const link of conflicts) {
      console.error(`  - code="${link.code}" id=${link.id} userId=${link.userId ?? 'anonymous'} createdAt=${link.createdAt.toISOString()}`);
    }
    console.error('Resolve these before applying k8s/ingress.yaml or terraform/frontend-cdn.tf.');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
