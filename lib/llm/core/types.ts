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

/**
 * Validate an action object to ensure it has all required fields
 * @param action The action object to validate
 * @returns Boolean indicating if the action is valid
 */
export function isValidAction(action: unknown): action is Action {
  return (
    action !== null &&
    typeof action === 'object' &&
    'action' in action &&
    typeof (action as unknown).action === 'string' &&
    'filePath' in action &&
    typeof (action as unknown).filePath === 'string' &&
    ('content' in action ? typeof (action as unknown).content === 'string' : true) &&
    'message' in action &&
    typeof (action as unknown).message === 'string'
  );
}

/**
 * Normalize action type to ensure compatibility with tools
 * @param action The action to normalize
 * @returns The normalized action
 */
export function normalizeAction(action: Action): Action {
  // Make a copy of the action to avoid modifying the original
  const normalizedAction = { ...action };

  // Get the lowercase action for comparison
  const actionLower = normalizedAction.action.toLowerCase().trim();

  // Normalize action type based on lowercase comparison
  if (actionLower === 'createfile') normalizedAction.action = 'createFile';
  else if (actionLower === 'editfile') normalizedAction.action = 'editFile';
  else if (actionLower === 'deletefile') normalizedAction.action = 'deleteFile';
  else if (actionLower === 'createdirectory') normalizedAction.action = 'createDirectory';
  else if (actionLower === 'removedirectory') normalizedAction.action = 'removeDirectory';
  else if (actionLower === 'read') normalizedAction.action = 'Read';

  // Ensure message exists
  if (!normalizedAction.message) {
    normalizedAction.message = `Performing ${normalizedAction.action} on ${normalizedAction.filePath}`;
  }

  return normalizedAction;
}
