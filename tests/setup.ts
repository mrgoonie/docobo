import { PrismaClient } from '@prisma/client';

// Test database connection
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL || 'postgresql://postgres:postgresql@localhost:5432/docobo_test',
    },
  },
});

// Set test environment
process.env.NODE_ENV = 'test';

// Mock environment variables for tests
process.env.DISCORD_TOKEN = 'test_discord_token';
process.env.DISCORD_CLIENT_ID = '1234567890123456789';
process.env.POLAR_WEBHOOK_SECRET = 'test_polar_secret_base64encoded';
process.env.SEPAY_WEBHOOK_SECRET = 'test_sepay_api_key';

// Clean up before all tests
beforeAll(async () => {
  try {
    // Connect to database
    await testPrisma.$connect();
    console.log('Test database connected');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
});

// Clean up after each test
afterEach(async () => {
  // Delete all records in correct order (respect foreign keys)
  await testPrisma.webhookEvent.deleteMany();
  await testPrisma.subscription.deleteMany();
  await testPrisma.member.deleteMany();
  await testPrisma.paidRole.deleteMany();
  await testPrisma.guild.deleteMany();
});

// Disconnect after all tests
afterAll(async () => {
  await testPrisma.$disconnect();
  console.log('Test database disconnected');
});

// Export test prisma client
export { testPrisma };
