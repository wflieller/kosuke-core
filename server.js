#!/usr/bin/env node

/**
 * Custom Next.js server with Docker container cleanup on exit
 */
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { execSync } from 'child_process';

// Create the Next.js app
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Docker container cleanup function
const cleanupDockerContainers = () => {
  console.log('\n🧹 Cleaning up Docker preview containers...');
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
  }
};

// Set up cleanup on exit
let isCleaningUp = false;
const performCleanup = () => {
  if (isCleaningUp) return;
  isCleaningUp = true;

  console.log('\n🛑 Shutting down server...');
  cleanupDockerContainers();
  console.log('👋 Goodbye!');
  process.exit(0);
};

// Register shutdown handlers
process.on('SIGINT', performCleanup);
process.on('SIGTERM', performCleanup);
process.on('SIGHUP', performCleanup);

// Start the server
app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, err => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log('🔌 Docker container cleanup activated (press Ctrl+C to exit and clean up)');
  });
});
