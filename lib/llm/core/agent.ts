import { eq, desc, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import path from 'path';
import { LLM } from '@/lib/constants';
import { db } from '@/lib/db/drizzle';
import { chatMessages, actions } from '@/lib/db/schema';
import { getProjectPath } from '../../fs/operations';
import { getTool } from '../tools';
import { PipelineType, Pipeline } from '../pipelines/types';
import { getPipeline } from '../pipelines';
import { Action } from './types';

/**
 * Agent class responsible for orchestrating project modifications and handling UI updates
 */
export class Agent {
  private projectId: number;
  private pipeline: Pipeline;

  constructor(projectId: number, pipelineType: PipelineType = PipelineType.NAIVE) {
    this.projectId = projectId;
    this.pipeline = getPipeline(pipelineType);
    console.log(
      `🚀 Agent initialized with pipeline type: ${pipelineType}, pipeline: ${this.pipeline.constructor.name}`
    );
  }

  /**
   * Run the agent to process a project modification request
   */
  async run(prompt: string): Promise<{ success: boolean; error?: string }> {
    console.log(
      `🤖 Processing modification request for project ID: ${this.projectId} using ${this.pipeline.constructor.name}`
    );
    const processingStart = Date.now();

    try {
      // Get the initial messages from the database
      console.log('🔍 Fetching existing chat messages from database...');
      const history = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.projectId, this.projectId))
        .orderBy(desc(chatMessages.timestamp))
        .limit(LLM.MAX_MESSAGES);

      console.log(`📊 Found ${history.length} existing messages`);

      // Find the last assistant message or create a placeholder
      const lastAssistantMessageIndex = history.findIndex(msg => msg.role === 'assistant');

      let lastAssistantMessage;

      if (lastAssistantMessageIndex === -1) {
        console.log('ℹ️ No assistant message found, creating one...');
        // Create a placeholder message if one doesn't exist
        const [newAssistantMessage] = await db
          .insert(chatMessages)
          .values({
            projectId: this.projectId,
            content: "I'm analyzing your request and preparing to make changes...",
            role: 'assistant',
          })
          .returning();

        console.log(`✅ Created new assistant message with ID: ${newAssistantMessage.id}`);
        lastAssistantMessage = newAssistantMessage;
      } else {
        console.log(`ℹ️ Found existing assistant message at index ${lastAssistantMessageIndex}`);
        lastAssistantMessage = history[lastAssistantMessageIndex];
      }

      // Process with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Processing timeout exceeded'));
        }, LLM.PROCESSING_TIMEOUT);
      });

      try {
        // Create a placeholder assistant message
        const initialResult = await this.sendOperationUpdate(
          'edit', // Operation type doesn't matter for placeholder
          '', // No specific file path
          "I'm analyzing your request and preparing to make changes...",
          'pending'
        );

        console.log(
          `🔄 Starting pipeline processing with prompt: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`
        );

        // Run the pipeline
        let pipelineResult: { actions?: Action[] };
        try {
          pipelineResult = await Promise.race([
            this.pipeline.processPrompt(this.projectId, prompt),
            timeoutPromise,
          ]);
          console.log(
            `✅ Pipeline processing completed. Result: ${JSON.stringify(pipelineResult, null, 2)}`
          );
        } catch (pipelineError) {
          console.error(`❌ Pipeline processing error:`, pipelineError);
          throw pipelineError;
        }

        // Handle the actions from the pipeline
        console.log(
          `🔍 Checking actions from pipeline result. Has actions: ${!!pipelineResult.actions}, Length: ${pipelineResult.actions?.length || 0}`
        );

        if (pipelineResult.actions && pipelineResult.actions.length > 0) {
          console.log(`🔄 Found ${pipelineResult.actions.length} actions to execute:`);
          pipelineResult.actions.forEach((action: Action, index: number) => {
            console.log(`   Action ${index + 1}: ${action.action} on ${action.filePath}`);
          });

          // Execute each action in sequence
          let allActionsSuccessful = true;
          for (const [index, action] of pipelineResult.actions.entries()) {
            console.log(
              `⏳ Executing action ${index + 1}/${pipelineResult.actions.length}: ${action.action} on ${action.filePath}`
            );
            const actionSuccess = await this.executeAction(action);
            console.log(
              `${actionSuccess ? '✅' : '❌'} Action ${index + 1} execution ${actionSuccess ? 'succeeded' : 'failed'}`
            );

            if (!actionSuccess) {
              console.error(
                `❌ Action ${index + 1} (${action.action} on ${action.filePath}) failed to execute. Stopping execution.`
              );
              allActionsSuccessful = false;
              break;
            }
          }

          // Generate a summary of changes
          if (allActionsSuccessful) {
            console.log('🔄 Generating summary of changes...');
            const summary = await this.generateChangesSummary(pipelineResult.actions);
            console.log(`📝 Summary generated: ${summary}`);

            // Update the message content with the summary
            if (initialResult.message?.id) {
              await db
                .update(chatMessages)
                .set({
                  content: summary,
                  timestamp: new Date(),
                })
                .where(eq(chatMessages.id, initialResult.message.id));

              console.log(`✅ Updated message content with summary`);
            }
          } else {
            await this.sendOperationUpdate(
              'error',
              '',
              `I encountered some issues while making the requested changes. Please check the operation log for details.`,
              'error'
            );
            console.log(`⚠️ Some actions failed to execute`);
          }
        } else {
          console.warn(
            `⚠️ No actions returned from pipeline. Pipeline result: ${JSON.stringify(pipelineResult)}`
          );
          await this.sendOperationUpdate(
            'error',
            '',
            `I was unable to understand how to make the requested changes. Please try rephrasing your request.`,
            'error'
          );
        }

        console.log(`✅ Successfully processed modification request`);
      } catch (error) {
        console.error('❌ Error or timeout processing modification:', error);
        // Update message with error information
        await db
          .update(chatMessages)
          .set({
            content:
              'I encountered an error while processing your request. Please try again later.',
            timestamp: new Date(),
          })
          .where(eq(chatMessages.id, lastAssistantMessage.id));

        console.log(`⚠️ Updated message with error information`);
        throw error;
      }

      // Revalidate the path to update the UI
      revalidatePath(`/projects/${this.projectId}`);

      const processingEnd = Date.now();
      console.log(`⏱️ Total processing time: ${processingEnd - processingStart}ms`);

      return { success: true };
    } catch (error) {
      console.error(`❌ Error in Agent.run:`, error);
      return { success: false, error: 'Failed to process modification request' };
    }
  }

  /**
   * Generate a summary of changes made to the project
   */
  private async generateChangesSummary(actions: Action[]): Promise<string> {
    try {
      // Group actions by type
      const createdFiles = actions.filter(a => a.action === 'createFile').map(a => a.filePath);
      const editedFiles = actions.filter(a => a.action === 'editFile').map(a => a.filePath);
      const deletedFiles = actions.filter(a => a.action === 'deleteFile').map(a => a.filePath);

      // Create a summary message
      const summary = [
        "I've completed the requested changes:",
        createdFiles.length > 0
          ? `\n📄 Created ${createdFiles.length} files:\n${createdFiles.map(f => `- ${f}`).join('\n')}`
          : '',
        editedFiles.length > 0
          ? `\n✏️ Modified ${editedFiles.length} files:\n${editedFiles.map(f => `- ${f}`).join('\n')}`
          : '',
        deletedFiles.length > 0
          ? `\n🗑️ Deleted ${deletedFiles.length} files:\n${deletedFiles.map(f => `- ${f}`).join('\n')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      return summary;
    } catch (error) {
      console.error('Error generating changes summary:', error);
      return "I've completed all the requested changes successfully.";
    }
  }

  /**
   * Send an operation update to the chat and save to actions table
   */
  async sendOperationUpdate(
    operationType: 'create' | 'edit' | 'delete' | 'error' | 'read' | 'createDir' | 'removeDir',
    filePath: string,
    operationMessage: string,
    status: 'pending' | 'completed' | 'error' = 'completed'
  ) {
    try {
      // Find the most recent assistant message to update instead of creating a new one
      const existingMessages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.projectId, this.projectId))
        .orderBy(desc(chatMessages.timestamp))
        .limit(5); // Get a few most recent messages

      let messageId: number;

      // Find the last assistant message that's being used for operations
      const lastAssistantMessage = existingMessages.find(
        msg =>
          msg.role === 'assistant' &&
          (msg.content.includes('analysing your request') ||
            msg.content.includes('analyzing your request') ||
            msg.content.includes('I am analyzing') ||
            msg.content.includes("I'm analyzing") ||
            msg.content.includes('making changes'))
      );

      if (lastAssistantMessage) {
        // Use the existing message
        messageId = lastAssistantMessage.id;
        console.log(`✅ Using existing assistant message: ${messageId} for operation`);
      } else {
        // Create a new message for the operation update
        const [newMessage] = await db
          .insert(chatMessages)
          .values({
            projectId: this.projectId,
            content: `I'm analyzing your request and preparing to make changes...`,
            role: 'assistant',
          })
          .returning();

        messageId = newMessage.id;
        console.log(`✅ Created new assistant message: ${messageId} for operation`);
      }

      // Map operationType to proper type for database
      let dbOperationType = operationType;
      if (operationType === 'createDir') {
        dbOperationType = 'create';
      } else if (operationType === 'removeDir') {
        dbOperationType = 'delete';
      }

      // Add the operation to actions table
      const [] = await db
        .insert(actions)
        .values({
          messageId: messageId,
          type: dbOperationType,
          path: filePath,
          status,
          timestamp: new Date(),
        })
        .returning();

      console.log(
        `✅ Action saved: ${operationType} ${filePath} for message ${messageId} with status ${status}`
      );

      // Revalidate the path to update the UI
      revalidatePath(`/projects/${this.projectId}`);

      return {
        success: true,
        message: { id: messageId, content: operationMessage, role: 'assistant' },
      };
    } catch (error) {
      console.error(`❌ Error sending operation update:`, error);
      return { success: false, error: 'Failed to send operation update' };
    }
  }

  /**
   * Execute a single action
   */
  async executeAction(action: Action): Promise<boolean> {
    console.log(`🔧 Executing action: ${action.action} on ${action.filePath}`);

    try {
      // Get the appropriate tool
      const tool = getTool(action.action);

      if (!tool) {
        console.error(`❌ Unknown action: ${action.action}`);
        await this.sendOperationUpdate(
          'error',
          action.filePath,
          `Error: Unknown action '${action.action}'`,
          'error'
        );
        return false;
      }

      // Map action type to operation type
      const operationType =
        action.action === 'createFile'
          ? 'create'
          : action.action === 'createDirectory'
            ? 'createDir'
            : action.action === 'editFile'
              ? 'edit'
              : action.action === 'deleteFile'
                ? 'delete'
                : action.action === 'removeDirectory'
                  ? 'removeDir'
                  : action.action === 'search' || action.action === 'Read'
                    ? 'read'
                    : 'error';

      // Send an update about the operation we're about to perform with pending status
      const result = await this.sendOperationUpdate(
        operationType,
        action.filePath,
        action.message,
        'pending'
      );

      if (!result.success || !result.message) {
        console.error(`❌ Failed to create operation message`);
        return false;
      }

      const messageId = result.message.id;

      // Execute the tool with the appropriate parameters
      try {
        switch (action.action) {
          case 'editFile':
          case 'createFile': {
            if (!action.content) {
              console.error(`❌ Missing content for ${action.action} action`);
              await this.sendOperationUpdate(
                'error',
                action.filePath,
                `Error: Missing content for ${action.action} action on ${action.filePath}`,
                'error'
              );
              return false;
            }
            // Construct full path for file operations
            const fullPath = path.join(getProjectPath(this.projectId), action.filePath);
            const success = await tool.execute(fullPath, action.content);

            if (!success) {
              console.error(`❌ Failed to ${action.action} file: ${action.filePath}`);
              await this.sendOperationUpdate(
                'error',
                action.filePath,
                `Error: Failed to ${action.action} file ${action.filePath}`,
                'error'
              );
              return false;
            }

            // Update operation status to completed after successful execution
            await db
              .update(actions)
              .set({
                status: 'completed',
                timestamp: new Date(),
              })
              .where(
                and(
                  eq(actions.messageId, messageId),
                  eq(actions.path, action.filePath),
                  eq(
                    actions.type,
                    operationType === 'createDir' || operationType === 'removeDir'
                      ? operationType === 'createDir'
                        ? 'create'
                        : 'delete'
                      : operationType
                  )
                )
              );

            console.log(
              `✅ Updated operation status to completed: ${operationType} ${action.filePath}`
            );
            break;
          }
          case 'deleteFile':
          case 'removeDirectory': {
            // Construct full path for file operations
            const deletePath = path.join(getProjectPath(this.projectId), action.filePath);
            const success = await tool.execute(deletePath);

            if (!success) {
              console.error(
                `❌ Failed to ${action.action === 'deleteFile' ? 'delete file' : 'remove directory'}: ${action.filePath}`
              );
              await this.sendOperationUpdate(
                'error',
                action.filePath,
                `Error: Failed to ${action.action === 'deleteFile' ? 'delete file' : 'remove directory'} ${action.filePath}`,
                'error'
              );
              return false;
            }

            // Update operation status to completed after successful execution
            await db
              .update(actions)
              .set({
                status: 'completed',
                timestamp: new Date(),
              })
              .where(
                and(
                  eq(actions.messageId, messageId),
                  eq(actions.path, action.filePath),
                  eq(
                    actions.type,
                    operationType === 'createDir' || operationType === 'removeDir'
                      ? operationType === 'createDir'
                        ? 'create'
                        : 'delete'
                      : operationType
                  )
                )
              );

            console.log(
              `✅ Updated operation status to completed: ${operationType} ${action.filePath}`
            );
            break;
          }
          case 'createDirectory': {
            // Construct full path for directory operations
            const dirPath = path.join(getProjectPath(this.projectId), action.filePath);
            const success = await tool.execute(dirPath);

            if (!success) {
              console.error(`❌ Failed to create directory: ${action.filePath}`);
              await this.sendOperationUpdate(
                'error',
                action.filePath,
                `Error: Failed to create directory ${action.filePath}`,
                'error'
              );
              return false;
            }

            // Update operation status to completed after successful execution
            await db
              .update(actions)
              .set({
                status: 'completed',
                timestamp: new Date(),
              })
              .where(
                and(
                  eq(actions.messageId, messageId),
                  eq(actions.path, action.filePath),
                  eq(
                    actions.type,
                    operationType === 'createDir' || operationType === 'removeDir'
                      ? operationType === 'createDir'
                        ? 'create'
                        : 'delete'
                      : operationType
                  )
                )
              );

            console.log(
              `✅ Updated operation status to completed: ${operationType} ${action.filePath}`
            );
            break;
          }
          case 'search': {
            // Execute the search
            await tool.execute(action.filePath);

            // Update operation status to completed after successful execution
            await db
              .update(actions)
              .set({
                status: 'completed',
                timestamp: new Date(),
              })
              .where(
                and(
                  eq(actions.messageId, messageId),
                  eq(actions.path, action.filePath),
                  eq(
                    actions.type,
                    operationType === 'createDir' || operationType === 'removeDir'
                      ? operationType === 'createDir'
                        ? 'create'
                        : 'delete'
                      : operationType
                  )
                )
              );

            console.log(
              `✅ Updated operation status to completed: ${operationType} ${action.filePath}`
            );
            break;
          }
          case 'Read': {
            // Construct full path for file operations
            const fullPath = path.join(getProjectPath(this.projectId), action.filePath);
            await tool.execute(fullPath);

            // Update operation status to completed after successful execution
            await db
              .update(actions)
              .set({
                status: 'completed',
                timestamp: new Date(),
              })
              .where(
                and(
                  eq(actions.messageId, messageId),
                  eq(actions.path, action.filePath),
                  eq(
                    actions.type,
                    operationType === 'createDir' || operationType === 'removeDir'
                      ? operationType === 'createDir'
                        ? 'create'
                        : 'delete'
                      : operationType
                  )
                )
              );

            console.log(
              `✅ Updated operation status to completed: ${operationType} ${action.filePath}`
            );
            break;
          }
          default:
            console.error(`❌ Unsupported action: ${action.action}`);
            await this.sendOperationUpdate(
              'error',
              action.filePath,
              `Error: Unsupported action '${action.action}'`,
              'error'
            );
            return false;
        }

        return true;
      } catch (error) {
        console.error(`❌ Error executing action:`, error);
        // Update the operation status to error
        await db
          .update(actions)
          .set({
            status: 'error',
            timestamp: new Date(),
          })
          .where(
            and(
              eq(actions.messageId, messageId),
              eq(actions.path, action.filePath),
              eq(
                actions.type,
                operationType === 'createDir' || operationType === 'removeDir'
                  ? operationType === 'createDir'
                    ? 'create'
                    : 'delete'
                  : operationType
              )
            )
          );

        await this.sendOperationUpdate(
          'error',
          action.filePath,
          `Error: Failed to ${action.action} on ${action.filePath}: ${(error as Error).message}`,
          'error'
        );
        return false;
      }
    } catch (error) {
      console.error(`❌ Error in executeAction:`, error);
      await this.sendOperationUpdate(
        'error',
        action.filePath,
        `Error: Failed to ${action.action} on ${action.filePath}: ${(error as Error).message}`,
        'error'
      );
      return false;
    }
  }
}

/**
 * Process a project modification request using the agent (legacy function for backward compatibility)
 */
export async function processProjectModification(
  projectId: number,
  prompt: string,
  pipelineType: PipelineType = PipelineType.NAIVE
) {
  const agent = new Agent(projectId, pipelineType);
  return agent.run(prompt);
}

/**
 * Legacy function for backward compatibility
 */
export async function sendOperationUpdate(
  projectId: number,
  operationType: 'create' | 'edit' | 'delete' | 'error' | 'read' | 'createDir' | 'removeDir',
  filePath: string,
  operationMessage: string,
  status: 'pending' | 'completed' | 'error' = 'completed'
) {
  const agent = new Agent(projectId);
  return agent.sendOperationUpdate(operationType, filePath, operationMessage, status);
}

/**
 * Legacy function for backward compatibility
 */
export async function executeAction(projectId: number, action: Action): Promise<boolean> {
  const agent = new Agent(projectId);
  return agent.executeAction(action);
}
