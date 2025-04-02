/**
 * Tool interface for agent operations
 */
export interface Tool {
  name: string;
  description: string;
  execute: (...args: unknown[]) => Promise<unknown>;
}

// Import tools
import { readFileTool } from './readFileTool';
import { editFileTool } from './editFileTool';
import { createFileTool } from './createFileTool';
import { deleteFileTool } from './deleteFileTool';
import { listFilesTool } from './listFilesTool';
import { createDirectoryTool } from './createDirectoryTool';
import { removeDirectoryTool } from './removeDirectoryTool';

/**
 * All available tools
 */
export const tools = [
  readFileTool,
  editFileTool,
  createFileTool,
  deleteFileTool,
  listFilesTool,
  createDirectoryTool,
  removeDirectoryTool,
];

/**
 * Get all available tools
 */
export function getTools(): Tool[] {
  return tools;
}

/**
 * Get a specific tool by name
 */
export function getTool(name: string): Tool | undefined {
  return tools.find(tool => tool.name === name);
}

export {
  readFileTool,
  editFileTool,
  createFileTool,
  deleteFileTool,
  listFilesTool,
  createDirectoryTool,
  removeDirectoryTool,
};
