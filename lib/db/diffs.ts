import { eq, desc, asc, sql } from 'drizzle-orm';

import { db } from './drizzle';
import { diffs, NewDiff, Diff, chatMessages } from './schema';

/**
 * Create a new diff
 */
export async function createDiff(diff: NewDiff): Promise<Diff> {
  const [createdDiff] = await db.insert(diffs).values(diff).returning();
  return createdDiff;
}

/**
 * Get a diff by ID
 */
export async function getDiffById(id: number): Promise<Diff | undefined> {
  const [diff] = await db.select().from(diffs).where(eq(diffs.id, id));

  return diff;
}

/**
 * Get diffs by project ID
 */
export async function getDiffsByProjectId(
  projectId: number,
  limit: number = 50,
  offset: number = 0
): Promise<Diff[]> {
  return db
    .select()
    .from(diffs)
    .where(eq(diffs.projectId, projectId))
    .orderBy(desc(diffs.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get diffs by chat message ID
 */
export async function getDiffsByChatMessageId(chatMessageId: number): Promise<Diff[]> {
  return db
    .select()
    .from(diffs)
    .where(eq(diffs.chatMessageId, chatMessageId))
    .orderBy(asc(diffs.filePath));
}

/**
 * Update diff status
 */
export async function updateDiffStatus(
  id: number,
  status: 'pending' | 'applied' | 'rejected',
  appliedAt?: Date
): Promise<Diff | undefined> {
  const updateData: Partial<Diff> = { status };

  if (status === 'applied' && appliedAt) {
    updateData.appliedAt = appliedAt;
  }

  const [updatedDiff] = await db.update(diffs).set(updateData).where(eq(diffs.id, id)).returning();

  return updatedDiff;
}

/**
 * Get diffs with chat message details
 */
export async function getDiffsWithChatDetails(projectId: number) {
  return db
    .select({
      diff: diffs,
      messageContent: chatMessages.content,
      messageRole: chatMessages.role,
    })
    .from(diffs)
    .leftJoin(chatMessages, eq(diffs.chatMessageId, chatMessages.id))
    .where(eq(diffs.projectId, projectId))
    .orderBy(desc(diffs.createdAt));
}

/**
 * Delete a diff
 */
export async function deleteDiff(id: number): Promise<void> {
  await db.delete(diffs).where(eq(diffs.id, id));
}

/**
 * Get diff count for a project
 */
export async function getDiffCount(projectId: number): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(diffs)
    .where(eq(diffs.projectId, projectId));

  return result.count;
}
