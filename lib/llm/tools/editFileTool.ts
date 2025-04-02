import { updateFile } from '../../fs/operations';
import { Tool } from './index';

/**
 * Edit a file in the project
 */
export const editFileTool: Tool = {
  name: 'editFile',
  description: 'Edit an existing file in the project',
  execute: async (...args) => {
    const filePath = args[0] as string;
    const content = args[1] as string;
    try {
      console.log(`✏️ Editing file: ${filePath}`);
      await updateFile(filePath, content);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error editing file: ${filePath}`, error);
      return { success: false, error: `Failed to edit file: ${error}` };
    }
  },
};
