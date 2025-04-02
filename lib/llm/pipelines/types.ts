/**
 * Available pipeline types
 */
export enum PipelineType {
  NAIVE = 'naive',
  ROO_CODE = 'roo-code',
}

import { Action } from '../core/types';

/**
 * Interface that all pipelines must implement
 */
export interface Pipeline {
  /**
   * Process a user prompt and return a list of actions to perform
   * @param projectId - The ID of the project to modify
   * @param prompt - The user's prompt/request
   * @returns Promise with actions to be performed by the agent
   */
  processPrompt(
    projectId: number,
    prompt: string
  ): Promise<{
    success: boolean;
    error?: string;
    actions?: Action[];
  }>;
}
