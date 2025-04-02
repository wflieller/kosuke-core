#!/usr/bin/env node

/**
 * Docker container cleanup utility
 * Run with: node scripts/cleanup-docker.js
 */

import { execSync } from 'child_process';

console.log('🧹 Cleaning up Docker preview containers...');

try {
  // Stop running containers
  try {
    const runningContainers = execSync('docker ps -q --filter name=project-preview')
      .toString()
      .trim();
    if (runningContainers) {
      console.log('🛑 Stopping running containers');
      execSync('docker stop $(docker ps -q --filter name=project-preview)');
      console.log('✅ Containers stopped');
    } else {
      console.log('ℹ️ No running containers found');
    }
  } catch (stopError) {
    console.error('❌ Error stopping containers:', stopError.message);
  }

  // Remove all containers
  try {
    const allContainers = execSync('docker ps -a -q --filter name=project-preview')
      .toString()
      .trim();
    if (allContainers) {
      console.log('🗑️ Removing all preview containers');
      execSync('docker rm -f $(docker ps -a -q --filter name=project-preview)');
      console.log('✅ All containers removed');
    } else {
      console.log('ℹ️ No containers to remove');
    }
  } catch (rmError) {
    console.error('❌ Error removing containers:', rmError.message);
  }

  console.log('✅ Docker cleanup complete');
} catch (error) {
  console.error('❌ Error during Docker cleanup:', error.message);
  process.exit(1);
}
