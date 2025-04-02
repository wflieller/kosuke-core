import { deleteDir } from '../../fs/operations';
import { Tool } from './index';

/**
 * Remove a directory from the project
 */
export const removeDirectoryTool: Tool = {
  name: 'removeDirectory',
  description: 'Remove a directory from the project',
  execute: async (...args) => {
    const dirPath = args[0] as string;
    try {
      console.log(`🗑️ Removing directory: ${dirPath}`);
      await deleteDir(dirPath);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error removing directory: ${dirPath}`, error);
      return { success: false, error: `Failed to remove directory: ${error}` };
    }
  },
};
