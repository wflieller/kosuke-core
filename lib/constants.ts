/**
 * Application-wide constants
 */

// File System
export const PROJECTS_DIR = process.env.PROJECTS_DIR || 'projects';
export const TEMPLATE_DIR =
  process.env.TEMPLATE_DIR || '/Volumes/Mac Studio External Storage/software/kosuke-template';

// Storage
export const STORAGE_BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'uploads';
export const STORAGE_BASE_URL = process.env.MINIO_BASE_URL || 'http://localhost:9000';

// LLM
export const LLM = {
  // Model configurations
  DEFAULT_MODEL: 'gemini-2.5-pro-preview-03-25',
  PREMIUM_MODEL: 'gemini-2.5-pro-preview-03-25',
  FLASH_MODEL: 'gemini-2.0-flash',

  // System settings
  MAX_MESSAGES: 50, // Maximum number of chat messages to fetch from history
  MAX_RETRIES: 3, // Maximum number of retries for failed API calls
  RETRY_DELAY: 5000, // Base delay between retries in milliseconds (increases exponentially)
  PROCESSING_TIMEOUT: 120000, // Maximum time to wait for processing (120 seconds)

  // Message limits by subscription tier
  MESSAGE_LIMITS: {
    free: 25, // Free tier - limited to 25 messages
    premium: 100, // Pro plan
    business: 1000, // Business plan
    enterprise: 5000, // Enterprise plan
  },
};

// Agent Service
export const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8000';

// Preview
export const PREVIEW = {
  CONTAINER_NAME_PREFIX: 'project-preview-',
  DEFAULT_IMAGE: process.env.PREVIEW_DEFAULT_IMAGE || 'ghcr.io/filopedraz/kosuke-template:latest',
  COMPILATION_TIMEOUT: 90000, // 90 seconds
  SERVER_RESPONSE_TIMEOUT: 10000, // 10 seconds
};

// Context API
export const CONTEXT = {
  MAX_CONTEXT_SIZE: 500000, // tokens
  INCLUDE_EXTENSIONS: ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.html', '.md'],
  EXCLUDE_FILES: ['package-lock.json'],
  EXCLUDE_DIRS: ['node_modules', '.next', 'out', 'build', 'dist', '.git', '.github', '.husky'],
};

// File Explorer
export const FILE_EXPLORER = {
  // Match with context exclude patterns for consistency
  EXCLUDE_DIRS: ['node_modules', '.next', 'out', 'build', 'dist', '.git', '.github'],
};

// Subscriptions
export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PREMIUM: 'premium',
  BUSINESS: 'business',
  ENTERPRISE: 'enterprise',
};

export const TIER_PRICING = {
  free: 0,
  premium: 20, // $20/mo as shown in UI
  business: 200, // $200/mo as shown in UI
  enterprise: null, // Contact us
};

export const TIER_FEATURES = {
  free: ['Up to 3 projects', 'Basic AI functionality', 'Community support'],
  premium: [
    'Up to 10 projects',
    'Enhanced AI capabilities',
    'Priority email support',
    'Custom project templates',
  ],
  business: [
    'Unlimited projects',
    'Advanced AI capabilities',
    'Priority support with 24hr response',
    'Team collaboration features',
    'Custom integrations',
  ],
  enterprise: [
    'All Business features',
    'Dedicated account manager',
    'Custom SLA',
    'Enterprise security features',
    'Advanced reporting and analytics',
  ],
};
