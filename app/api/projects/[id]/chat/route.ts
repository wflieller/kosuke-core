import { eq, desc, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db/drizzle';
import { getProjectById } from '@/lib/db/projects';
import { chatMessages, actions, Action } from '@/lib/db/schema';
import { LLM } from '@/lib/constants';
import { uploadFile } from '@/lib/storage';
import { PipelineType } from '@/lib/llm/pipelines/types';
import { hasReachedMessageLimit } from '@/lib/models';
import { Agent } from '@/lib/llm/core/agent';

// Schema for sending a message - support both formats
const sendMessageSchema = z.union([
  z.object({
    message: z.object({
      content: z.string(),
      pipelineType: z.enum(['naive', 'roo_code']).optional(),
    }),
  }),
  z.object({
    content: z.string(),
    pipelineType: z.enum(['naive', 'roo_code']).optional(),
  })
]);

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
 * @deprecated This function may be used elsewhere in the codebase
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
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
/* eslint-enable @typescript-eslint/no-unused-vars */

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

    // Await params to get the id
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
): Promise<NextResponse> {
  try {
    // Get the session
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Await params to get the id
    const { id } = await params;
    const projectId = parseInt(id);

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

    // Parse and validate the request body
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    
    const parseResult = sendMessageSchema.safeParse(body);
    
    if (!parseResult.success) {
      console.error('Invalid request format:', parseResult.error);
      return NextResponse.json(
        { error: 'Invalid request format', details: parseResult.error.format() },
        { status: 400 }
      );
    }
    
    // Extract content and pipelineType based on the format received
    let messageContent: string;
    let rawPipelineType: string | undefined;
    
    if ('message' in parseResult.data) {
      // Format: { message: { content, pipelineType } }
      messageContent = parseResult.data.message.content;
      rawPipelineType = parseResult.data.message.pipelineType;
    } else {
      // Format: { content, pipelineType }
      messageContent = parseResult.data.content;
      rawPipelineType = parseResult.data.pipelineType;
    }
    
    // Map string pipeline type to enum
    let pipelineType: PipelineType;
    switch (rawPipelineType) {
      case 'roo_code':
        pipelineType = PipelineType.ROO_CODE;
        break;
      case 'naive':
      default:
        pipelineType = PipelineType.NAIVE;
    }

    console.log(`Received message content: "${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}"`);
    console.log(`Using pipeline type: ${pipelineType}`);

    // Save the user message to the database
    await db.insert(chatMessages).values({
      projectId,
      userId: session.user.id,
      content: messageContent,
      role: 'user',
      modelType: 'premium',
    });

    console.log(`Processing request with Agent class for project ${projectId}`);
    
    // Create an Agent instance and run it with the message content
    const agent = new Agent(projectId, pipelineType);
    const agentResult = await agent.run(messageContent);

    if (!agentResult.success) {
      console.error('Error processing request:', agentResult.error);
      return NextResponse.json(
        { message: 'Error processing request', error: agentResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing chat:', error);
    return NextResponse.json(
      { message: 'Error processing request', error: String(error) },
      { status: 500 }
    );
  }
}