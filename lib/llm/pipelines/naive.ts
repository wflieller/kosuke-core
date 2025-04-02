import { generateAICompletion } from '../api/ai-sdk';
import { getProjectContext } from '../utils/context';
import { buildNaivePrompt } from '../prompts/naive';
import { Pipeline } from './types';
import { CONTEXT } from '@/lib/constants';
import { Action } from '../core/types';

/**
 * Implementation of the naive pipeline which processes project modifications
 */
export class NaivePipeline implements Pipeline {
  async processPrompt(projectId: number, prompt: string) {
    console.log(`🤖 Processing naive pipeline for project ID: ${projectId}`);

    try {
      // Get the project context
      let context = '';
      try {
        console.log(`🔍 Getting project context for projectId: ${projectId}`);
        context = await getProjectContext(projectId, {
          maxSize: CONTEXT.MAX_CONTEXT_SIZE,
          excludeDirs: CONTEXT.EXCLUDE_DIRS,
          includeExtensions: CONTEXT.INCLUDE_EXTENSIONS,
          excludeFiles: CONTEXT.EXCLUDE_FILES,
        });
        console.log(`✅ Successfully retrieved project context`);
      } catch (contextError) {
        console.warn('⚠️ Error getting project context:', contextError);
        // Continue without context
      }

      // Build the prompt with context
      const messages = buildNaivePrompt(prompt, context);

      // Generate the AI response
      console.log(`🤖 Generating agent response using AI SDK`);
      const aiResponse = await generateAICompletion(messages, {
        timeoutMs: 90000, // 90 seconds timeout
        maxTokens: 2000,
      });

      // Parse the AI response to get the actions
      console.log(`🔍 Parsing AI response to extract actions...`);
      const actions = parseActionsFromResponse(aiResponse);
      console.log(`📋 Found ${actions.length} actions to execute`);

      // If no actions were parsed, return empty result
      if (actions.length === 0) {
        return {
          success: true,
          actions: [],
        };
      }

      return {
        success: true,
        actions,
      };
    } catch (error) {
      console.error(`❌ Error in naive pipeline:`, error);
      return { success: false, error: 'Failed to process modification request' };
    }
  }
}

/**
 * Parse the AI response to extract structured actions
 */
function parseActionsFromResponse(
  response: string | { text: string; modelType: string }
): Action[] {
  try {
    // Handle if response is an object (from Anthropic API)
    const responseText =
      typeof response === 'object' && response.text ? response.text : (response as string);

    // Clean up the response - remove markdown code blocks if present
    let cleanedResponse = responseText;

    // First, try to remove markdown code block syntax with a more comprehensive pattern
    cleanedResponse = cleanedResponse
      .replace(/```(?:json)?[\r\n]?([\s\S]*?)[\r\n]?```/g, '$1')
      .trim();

    // If the response still starts with backticks, try another approach
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
    }

    console.log('📝 Cleaned response:', cleanedResponse.substring(0, 200) + '...');

    // First, try to parse the entire response as JSON
    try {
      return JSON.parse(cleanedResponse) as Action[];
    } catch (error) {
      console.error('❌ Error parsing actions from cleaned response:', error);
      // If that fails, try to extract JSON from the response
      const jsonRegex = /\[\s*\{.*\}\s*\]/s;
      const match = cleanedResponse.match(jsonRegex);

      if (match && match[0]) {
        return JSON.parse(match[0]) as Action[];
      }

      // If still no valid JSON, look for action blocks
      const actionBlocks = cleanedResponse.match(/\{\s*"action":[^}]+\}/g);
      if (actionBlocks && actionBlocks.length > 0) {
        // Try to parse each block and combine them
        const actions: Action[] = [];
        for (const block of actionBlocks) {
          try {
            const action = JSON.parse(block) as Action;
            actions.push(action);
          } catch (e) {
            console.error('❌ Error parsing action block:', e);
          }
        }

        if (actions.length > 0) {
          return actions;
        }
      }

      // If all parsing attempts fail, return an empty array
      console.error('❌ Failed to parse actions from response');
      return [];
    }
  } catch (error) {
    console.error('❌ Error parsing actions:', error);
    return [];
  }
}
