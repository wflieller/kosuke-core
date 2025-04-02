import { eq, desc, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db/drizzle';
import { getProjectById } from '@/lib/db/projects';
import { chatMessages, actions, users, Action } from '@/lib/db/schema';
import { LLM } from '@/lib/constants';
import { uploadFile } from '@/lib/storage';
import { getPipeline, PipelineType } from '@/lib/llm/pipelines';
import { hasReachedMessageLimit } from '@/lib/models';

// Schema for sending a message
const sendMessageSchema = z.object({
  content: z.string(),
  contextFiles: z.array(z.object({
    name: z.string(),
    content: z.string(),
  })).optional(),
});

/**
 * Get chat history for a project
 */
async function getChatHistoryByProjectId(projectId: number, options: { limit?: number; oldest?: boolean } = {}) {
  const { limit = LLM.MAX_MESSAGES, oldest = false } = options;
  
  const history = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.projectId, projectId))
    .orderBy(oldest ? chatMessages.timestamp : desc(chatMessages.timestamp))
    .limit(limit);
  
  return oldest ? history : history.reverse();
}

/**
 * Save an uploaded image to Minio and return the URL
 */
async function saveUploadedImage(file: File, projectId: number): Promise<string> {
  // Create a prefix to organize images by project
  const prefix = `chat-images/project-${projectId}`;
  
  try {
    // Upload the file to Minio using the generic uploadFile function
    const imageUrl = await uploadFile(file, prefix);
    console.log(`✅ Image uploaded to Minio: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error('Error uploading image to Minio:', error);
    throw new Error('Failed to upload image');
  }
}

/**
 * Process a FormData request and extract the content and image
 */
async function processFormDataRequest(req: NextRequest, projectId: number): Promise<{ 
  content: string; 
  includeContext: boolean; 
  contextFiles: Array<{ name: string; content: string; }>;
  imageUrl?: string; 
}> {
  const formData = await req.formData();
  const content = formData.get('content') as string || '';
  const includeContext = formData.get('includeContext') === 'true';
  const contextFilesStr = formData.get('contextFiles') as string || '[]';
  const contextFiles = JSON.parse(contextFilesStr);
  
  // Process image if present
  const imageFile = formData.get('image') as File | null;
  let imageUrl: string | undefined;
  
  if (imageFile) {
    imageUrl = await saveUploadedImage(imageFile, projectId);
  }
  
  return {
    content,
    includeContext,
    contextFiles,
    imageUrl
  };
}

/**
 * GET /api/projects/[id]/chat
 * Get chat history for a specific project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the session
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const projectId = Number(id);
    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // Get the project
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if the user has access to the project
    if (project.createdBy !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get query parameters for pagination
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || '50');

    // Get chat history
    const chatHistory = await getChatHistoryByProjectId(projectId, {
      limit,
      oldest: true,
    });

    // Extract message IDs from assistant messages (since operations are linked to messages)
    const messageIds = chatHistory
      .filter(msg => msg.role === 'assistant')
      .map(msg => msg.id);

    // Fetch file operations for these messages if there are any
    let operations: Action[] = [];
    if (messageIds.length > 0) {
      operations = await db
        .select()
        .from(actions)
        .where(inArray(actions.messageId, messageIds));
    }

    // Group operations by message ID
    type FormattedOperation = {
      id: number;
      type: string;
      path: string;
      timestamp: Date;
      status: string;
      messageId: number;
    };
    
    const operationsByMessageId = operations.reduce<Record<number, FormattedOperation[]>>((acc, op) => {
      if (!acc[op.messageId]) {
        acc[op.messageId] = [];
      }
      acc[op.messageId].push({
        id: op.id,
        type: op.type,
        path: op.path,
        timestamp: op.timestamp,
        status: op.status,
        messageId: op.messageId
      });
      return acc;
    }, {});

    // Attach operations to their respective messages
    const messagesWithOperations = chatHistory.map(msg => ({
      ...msg,
      actions: operationsByMessageId[msg.id] || []
    }));

    // Return messages with nested operations
    return NextResponse.json({ 
      messages: messagesWithOperations
    });
  } catch (error) {
    console.error('Error getting chat history:', error);
    return NextResponse.json(
      { error: 'Failed to get chat history' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/chat
 * Send a message to the chat
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = Number(id);
    
    console.log(`📋 Processing chat message for project ID: ${projectId}`);
    
    // Get the session to check user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Check if the user has reached their message limit
    try {
      const limitReached = await hasReachedMessageLimit(session.user.id);
      if (limitReached) {
        throw new Error('PREMIUM_LIMIT_REACHED');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'PREMIUM_LIMIT_REACHED') {
        console.log('User has reached premium message limit, returning 403');
        return NextResponse.json(
          { error: 'You have reached your message limit for your current plan', code: 'PREMIUM_LIMIT_REACHED' },
          { status: 403 }
        );
      }
      // Other errors
      console.error('Error checking message limit:', error);
    }
    
    // Check content type to determine how to parse the request
    const contentType = req.headers.get('content-type') || '';
    let content = '';
    let imageUrl: string | undefined;
    
    if (contentType.includes('multipart/form-data')) {
      // Process form data with possible image upload
      const result = await processFormDataRequest(req, projectId);
      content = result.content;
      imageUrl = result.imageUrl;
    } else {
      // Process JSON request
      const body = await req.json();
      const parseResult = sendMessageSchema.safeParse(body);
      
      if (!parseResult.success) {
        console.error('❌ Invalid request body:', parseResult.error);
        return NextResponse.json(
          { error: 'Invalid request body', details: parseResult.error },
          { status: 400 }
        );
      }
      
      content = parseResult.data.content;
    }
    
    // Add image URL to content if present
    const messageContent = imageUrl 
      ? `${content}\n\n[Attached Image](${imageUrl})`
      : content;
    
    console.log(`📝 Received message: "${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}"`);
    
    // Save the user message to the database
    const [userMessage] = await db.insert(chatMessages).values({
      projectId,
      userId: session.user.id,
      role: 'user',
      content: messageContent,
      modelType: 'premium',
    }).returning();
    
    console.log('✅ User message saved:', userMessage.id);
    
    // Create a placeholder message for the assistant response
    const [assistantMessage] = await db.insert(chatMessages).values({
      projectId,
      role: 'assistant',
      content: "I'm analyzing your request...",
      modelType: 'premium',
    }).returning();
    
    console.log('✅ Placeholder assistant message created:', assistantMessage.id);
    
    // Process the request with the agent
    console.log('🤖 Processing request with pipeline');
    
    // Get the user's pipeline preference
    const userId = req.headers.get('User-Id');
    let pipelinePreference = 'naive'; // Default to naive pipeline
    
    if (userId) {
      const [userRecord] = await db.select()
        .from(users)
        .where(eq(users.id, parseInt(userId)));
      
      if (userRecord?.pipelinePreference) {
        pipelinePreference = userRecord.pipelinePreference;
      }
    }
    
    // Convert the preference string to the enum
    let pipelineType: PipelineType;
    switch (pipelinePreference) {
      case 'roo_code':
        pipelineType = PipelineType.ROO_CODE;
        break;
      default:
        pipelineType = PipelineType.NAIVE;
    }
    
    // Get the appropriate pipeline and process the message
    const pipeline = getPipeline(pipelineType);
    const result = await pipeline.processPrompt(projectId, messageContent);
    
    // Check if processing was successful
    if (!result.success) {
      console.error('❌ Agent processing failed:', result.error);
      
      // If the agent failed, update the assistant message with an error
      await db.update(chatMessages)
        .set({
          content: `I encountered an error while processing your request: ${result.error || 'Unknown error'}`,
          timestamp: new Date(),
        })
        .where(eq(chatMessages.id, assistantMessage.id));
    }
    
    // Get the updated assistant message to return to the client
    const [updatedMessage] = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.id, assistantMessage.id));
    
    return NextResponse.json({
      message: updatedMessage,
      success: result.success
    });
  } catch (error) {
    console.error('Error processing chat message:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}