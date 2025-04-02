import { eq, desc, asc, sql } from 'drizzle-orm';
import { db } from './drizzle';
import { chatMessages, NewChatMessage, ChatMessage, users } from './schema';

/**
 * Create a new chat message
 */
export async function createChatMessage(message: NewChatMessage): Promise<ChatMessage> {
  const [createdMessage] = await db.insert(chatMessages).values(message).returning();
  return createdMessage;
}

/**
 * Get a chat message by ID
 */
export async function getChatMessageById(id: number): Promise<ChatMessage | undefined> {
  const [message] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));

  return message;
}

/**
 * Get chat messages by project ID
 */
export async function getChatMessagesByProjectId(
  projectId: number,
  limit: number = 50,
  offset: number = 0
): Promise<ChatMessage[]> {
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.projectId, projectId))
    .orderBy(asc(chatMessages.timestamp))
    .limit(limit)
    .offset(offset);
}

/**
 * Get chat messages with user details
 */
export async function getChatMessagesWithUserDetails(projectId: number, limit: number = 50) {
  return db
    .select({
      message: chatMessages,
      userName: users.name,
    })
    .from(chatMessages)
    .leftJoin(users, eq(chatMessages.userId, users.id))
    .where(eq(chatMessages.projectId, projectId))
    .orderBy(asc(chatMessages.timestamp))
    .limit(limit);
}

/**
 * Get the latest chat message for a project
 */
export async function getLatestChatMessage(projectId: number): Promise<ChatMessage | undefined> {
  const [message] = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.projectId, projectId))
    .orderBy(desc(chatMessages.timestamp))
    .limit(1);

  return message;
}

/**
 * Delete a chat message
 */
export async function deleteChatMessage(id: number): Promise<void> {
  await db.delete(chatMessages).where(eq(chatMessages.id, id));
}

/**
 * Get chat message count for a project
 */
export async function getChatMessageCount(projectId: number): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(chatMessages)
    .where(eq(chatMessages.projectId, projectId));

  return result.count;
}
