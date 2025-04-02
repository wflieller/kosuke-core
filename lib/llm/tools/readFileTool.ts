import { readFile } from '../../fs/operations';
import { Tool } from './index';

/**
 * Read a file from the project
 */
export const readFileTool: Tool = {
  name: 'readFile',
  description: 'Read the contents of a file in the project',
  execute: async (...args) => {
    const filePath = args[0] as string;
    try {
      console.log(`🔍 Reading file: ${filePath}`);
      const content = await readFile(filePath);
      return { success: true, content };
    } catch (error) {
      console.error(`❌ Error reading file: ${filePath}`, error);
      return { success: false, error: `Failed to read file: ${error}` };
    }
  },
};

/**
 * Read a file (alternative name for readFile)
 */
export const ReadTool: Tool = {
  name: 'Read',
  description: 'Read the contents of a file in the project',
  execute: async (...args) => {
    const filePath = args[0] as string;
    try {
      console.log(`🔍 Reading file: ${filePath}`);
      const content = await readFile(filePath);
      return { success: true, content };
    } catch (error) {
      console.error(`❌ Error reading file: ${filePath}`, error);
      return { success: false, error: `Failed to read file: ${error}` };
    }
  },
};
