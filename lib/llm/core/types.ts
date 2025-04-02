/**
 * Type definitions for the LLM core module
 */

/**
 * Action interface for structured AI responses
 */
export interface Action {
  action:
    | 'editFile'
    | 'createFile'
    | 'deleteFile'
    | 'search'
    | 'Read'
    | 'createDirectory'
    | 'removeDirectory';
  filePath: string;
  content?: string;
  message: string;
}
