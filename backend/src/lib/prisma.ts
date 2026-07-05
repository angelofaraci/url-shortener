import { PrismaClient } from '@prisma/client';

// Singleton to avoid exhausting Postgres connections via hot-reload/multiple imports.
export const prisma = new PrismaClient();
