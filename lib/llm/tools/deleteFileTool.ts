import { deleteFile } from '../../fs/operations';
import { Tool } from './index';

/**
 * Delete a file from the project
 */
export const deleteFileTool: Tool = {
  name: 'deleteFile',
  description: 'Delete a file from the project',
  execute: async (...args) => {
    const filePath = args[0] as string;
    try {
      console.log(`🗑️ Deleting file: ${filePath}`);
      await deleteFile(filePath);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error deleting file: ${filePath}`, error);
      return { success: false, error: `Failed to delete file: ${error}` };
    }
  },
};
