import path from 'path';
import { listFilesRecursively } from '../../fs/operations';
import { Tool } from './index';

/**
 * List files in the project
 */
export const listFilesTool: Tool = {
  name: 'listFiles',
  description: 'List files in the project directory',
  execute: async (...args) => {
    const dirPath = (args[0] as string) || '';
    try {
      console.log(`📂 Listing files in directory: ${dirPath || 'root'}`);
      const files = await listFilesRecursively(dirPath);

      // Map files to be relative to the directory path
      const relativeFiles = files.map(file => {
        const relativePath = path.relative(dirPath, file);
        return relativePath;
      });

      return { success: true, files: relativeFiles };
    } catch (error) {
      console.error(`❌ Error listing files in directory: ${dirPath}`, error);
      return { success: false, error: `Failed to list files: ${error}` };
    }
  },
};
