import fs from 'fs/promises';
import { Tool } from './index';

/**
 * Create a directory in the project
 */
export const createDirectoryTool: Tool = {
  name: 'createDirectory',
  description: 'Create a new directory in the project',
  execute: async (...args) => {
    const dirPath = args[0] as string;
    try {
      console.log(`📁 Creating directory: ${dirPath}`);
      await fs.mkdir(dirPath, { recursive: true });
      return { success: true };
    } catch (error) {
      console.error(`❌ Error creating directory: ${dirPath}`, error);
      return { success: false, error: `Failed to create directory: ${error}` };
    }
  },
};
