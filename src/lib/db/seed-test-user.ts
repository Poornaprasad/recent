/**
 * Seed script to create a test user
 * Run with: tsx src/lib/db/seed-test-user.ts
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb, closeDb } from './script';
import { users } from './schema';
import { randomUUID } from 'crypto';

async function seedTestUser() {
  try {
    const db = getDb();

    // Test user credentials
    const testEmail = 'test@thebarnesfirm.com';
    const testPassword = 'Test123!';
    const testName = 'Test User';

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    if (existingUser.length > 0) {
      console.log('✓ Test user already exists');
      console.log(`  Email: ${testEmail}`);
      console.log(`  Password: ${testPassword}`);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // Create test user
    const newUser = {
      id: randomUUID(),
      name: testName,
      email: testEmail,
      password: hashedPassword,
      role: 'admin' as const,
      status: 'Active' as const,
      assignedStates: null,
    };

    await db.insert(users).values(newUser);

    console.log('✓ Test user created successfully!');
    console.log('\nLogin credentials:');
    console.log(`  Email: ${testEmail}`);
    console.log(`  Password: ${testPassword}`);
    console.log(`  Role: admin`);
    console.log('\nYou can now use these credentials to log in.');
  } catch (error) {
    console.error('✗ Error seeding test user:', error);
    throw error;
  } finally {
    await closeDb();
  }
}

// Run if called directly
if (require.main === module) {
  seedTestUser()
    .then(() => {
      console.log('\n✓ Seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Seed script failed:', error);
      process.exit(1);
    });
}

export { seedTestUser };
