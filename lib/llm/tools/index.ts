/**
 * Tool interface for agent operations
 */
export interface Tool {
  name: string;
  description: string;
  execute: (...args: unknown[]) => Promise<unknown>;
}

// Import tools
import { readFileTool, ReadTool } from './readFileTool';
import { editFileTool } from './editFileTool';
import { createFileTool } from './createFileTool';
import { deleteFileTool } from './deleteFileTool';
import { listFilesTool } from './listFilesTool';
import { createDirectoryTool } from './createDirectoryTool';
import { removeDirectoryTool } from './removeDirectoryTool';

// Map of tool names to their implementations for easy lookup
const toolMap: Record<string, Tool> = {
  // These are the primary tool names used in actions
  editFile: editFileTool,
  createFile: createFileTool,
  deleteFile: deleteFileTool,
  Read: ReadTool,
  search: listFilesTool,
  createDirectory: createDirectoryTool,
  removeDirectory: removeDirectoryTool,

  // Add alternative names/aliases for compatibility
  read: ReadTool,
  readFile: readFileTool,
  list: listFilesTool,
  listFiles: listFilesTool,
};

/**
 * All available tools
 */
export const tools = [
  readFileTool,
  ReadTool,
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
  console.log(`🔍 Looking for tool with name: "${name}"`);

  // Try to get tool from the map first
  if (toolMap[name]) {
    console.log(`✅ Found tool in map: ${name}`);
    return toolMap[name];
  }

  // Fall back to searching the tools array
  console.log(`⚠️ Tool not found in map, searching in tools array...`);
  console.log(`🧰 Available tools: ${tools.map(t => t.name).join(', ')}`);

  const tool = tools.find(tool => tool.name === name);

  if (tool) {
    console.log(`✅ Found tool in array: ${tool.name}`);
  } else {
    console.error(`❌ No tool found with name: "${name}"`);
  }

  return tool;
}

export {
  readFileTool,
  ReadTool,
  editFileTool,
  createFileTool,
  deleteFileTool,
  listFilesTool,
  createDirectoryTool,
  removeDirectoryTool,
};
