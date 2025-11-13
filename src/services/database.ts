import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Graceful shutdown
process.on('SIGINT', () => {
  void (async (): Promise<void> => {
    await prisma.$disconnect();
    process.exit(0);
  })();
});

process.on('SIGTERM', () => {
  void (async (): Promise<void> => {
    await prisma.$disconnect();
    process.exit(0);
  })();
});
