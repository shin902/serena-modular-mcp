/**
 * Application-wide constants
 */

/**
 * Retry configuration for upstream MCP server connections
 */
export const RETRY_CONFIG = {
  /** Maximum number of retry attempts when listing tools from upstream servers */
  MAX_RETRIES: 5,
  /** Base delay in milliseconds before first retry (exponential backoff applied) */
  BASE_DELAY_MS: 500,
} as const;

/**
 * Git push retry configuration
 */
export const GIT_PUSH_CONFIG = {
  /** Maximum number of retry attempts for git push operations */
  MAX_RETRIES: 4,
  /** Initial delay in milliseconds before first retry */
  INITIAL_DELAY_MS: 2000,
} as const;
