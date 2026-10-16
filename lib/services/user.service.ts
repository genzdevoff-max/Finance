import { randomUUID } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db, users, type User, assertDbConfigured } from '@/lib/db';

/**
 * Retrieves a user from the database by username (case-insensitive).
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  assertDbConfigured();
  const normalized = username.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.username}) = ${normalized}`)
    .limit(1);

  return user ?? null;
}

/**
 * Retrieves a user from the database by primary key ID.
 */
export async function getUserById(id: string): Promise<User | null> {
  assertDbConfigured();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user ?? null;
}

/**
 * Inserts a new user record into the database.
 */
export async function createUser(username: string, passwordHash: string): Promise<User> {
  assertDbConfigured();
  const id = randomUUID();
  const trimmed = username.trim();

  await db.insert(users).values({
    id,
    username: trimmed,
    passwordHash,
  });

  const created = await getUserById(id);
  if (!created) {
    throw new Error('Failed to create user in database.');
  }

  return created;
}

/**
 * Returns the total count of registered users.
 */
export async function countUsers(): Promise<number> {
  assertDbConfigured();
  const [result] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(users);

  return Number(result?.count || 0);
}
