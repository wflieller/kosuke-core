import { createFile } from '../../fs/operations';
import { Tool } from './index';

/**
 * Create a new file in the project
 */
export const createFileTool: Tool = {
  name: 'createFile',
  description: 'Create a new file in the project',
  execute: async (...args) => {
    const filePath = args[0] as string;
    const content = args[1] as string;
    try {
      console.log(`📝 Creating file: ${filePath}`);
      await createFile(filePath, content);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error creating file: ${filePath}`, error);
      return { success: false, error: `Failed to create file: ${error}` };
    }
  },
};
