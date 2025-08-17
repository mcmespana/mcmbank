/**
 * Feature Flags System
 * 
 * This system reads feature flags from environment variables and provides
 * utilities to check if features are enabled. It's designed to work well
 * with Vercel deployments where environment variables can be set per environment.
 */

export interface FeatureFlags {
  autologin: boolean;
}

/**
 * Gets all feature flags from environment variables
 * Feature flags should be prefixed with NEXT_PUBLIC_FEATURE_ for client-side access
 * or FEATURE_ for server-side only access
 */
function getFeatureFlags(): FeatureFlags {
  // For client-side access, we need NEXT_PUBLIC_ prefix
  const autologin = process.env.NEXT_PUBLIC_FEATURE_AUTOLOGIN === 'true';

  return {
    autologin,
  };
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[feature];
}

/**
 * Get all feature flags
 */
export function getFeatureFlag(): FeatureFlags {
  return getFeatureFlags();
}

/**
 * Hook for React components to access feature flags
 */
export function useFeatureFlags(): FeatureFlags {
  return getFeatureFlags();
}

/**
 * Server-side feature flag checking
 * This can be used in server components and API routes
 */
export function isFeatureEnabledServer(feature: keyof FeatureFlags): boolean {
  // Check both server and client environment variables
  const serverPrefix = `FEATURE_${feature.toUpperCase()}`;
  const clientPrefix = `NEXT_PUBLIC_FEATURE_${feature.toUpperCase()}`;
  
  return process.env[serverPrefix] === 'true' || process.env[clientPrefix] === 'true';
}

// Export specific feature flag constants for better TypeScript support
export const FEATURE_FLAGS = {
  AUTOLOGIN: 'autologin' as const,
} as const;