import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const links = [
  { code: 'gh-repo', url: 'https://github.com/anthropics/claude-code', expiresAt: null },
  { code: 'docs001', url: 'https://www.typescriptlang.org/docs/', expiresAt: null },
  { code: 'prisma1', url: 'https://www.prisma.io/docs', expiresAt: null },
  { code: 'promo24', url: 'https://example.com/summer-promo', expiresAt: new Date(Date.now() + 7 * ONE_DAY_MS) },
  { code: 'expired1', url: 'https://example.com/old-campaign', expiresAt: new Date(Date.now() - 3 * ONE_DAY_MS) },
  { code: 'mdn-js', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', expiresAt: null },
  { code: 'event01', url: 'https://example.com/conference-2026', expiresAt: new Date(Date.now() + 30 * ONE_DAY_MS) },
  { code: 'nodejs', url: 'https://nodejs.org/en/docs', expiresAt: null },
];

async function main(): Promise<void> {
  for (const link of links) {
    await prisma.link.upsert({
      where: { code: link.code },
      update: {},
      create: link,
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${links.length} links`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
