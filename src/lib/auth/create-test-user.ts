/**
 * Create test user with admin role
 * Run with: npx tsx src/lib/auth/create-test-user.ts
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb, closeDb } from '../db/script';
import { users } from '../db/schema';
import { randomUUID } from 'crypto';

async function createTestUser() {
  try {
    const db = getDb();

    // Test user credentials
    const testEmail = 'admin@thebarnesfirm.com';
    const testPassword = 'Admin123!';
    const testName = 'Admin User';

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    if (existingUser.length > 0) {
      console.log('✓ Admin user already exists');
      console.log(`  Email: ${testEmail}`);
      console.log(`  Password: ${testPassword}`);
      console.log(`  Role: admin`);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // Create admin user
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

    console.log('✓ Admin user created successfully!');
    console.log('\nLogin credentials:');
    console.log(`  Email: ${testEmail}`);
    console.log(`  Password: ${testPassword}`);
    console.log(`  Role: admin`);
    console.log('\nYou can now use these credentials to log in.');
  } catch (error) {
    console.error('✗ Error creating admin user:', error);
    throw error;
  } finally {
    await closeDb();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || require.main === module) {
  createTestUser()
    .then(() => {
      console.log('\n✓ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Script failed:', error);
      process.exit(1);
    });
}

export { createTestUser };

