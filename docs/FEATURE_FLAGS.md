# Feature Flags System

This document describes the Feature Flags system implemented in MCM Bank that works seamlessly with Vercel deployments.

## Overview

The Feature Flags system allows you to enable/disable features without code changes by using environment variables. This is particularly useful for:

- A/B testing
- Gradual feature rollouts
- Development and testing
- Emergency feature toggles

## Usage

### Environment Variables

Feature flags are controlled via environment variables with the following naming convention:

- **Client-side flags**: `NEXT_PUBLIC_FEATURE_<FLAG_NAME>=true|false`
- **Server-side flags**: `FEATURE_<FLAG_NAME>=true|false`

Client-side flags are accessible in browser components, while server-side flags work in server components and API routes.

### In Code

```typescript
import { useFeatureFlags, isFeatureEnabled } from '@/lib/feature-flags'

// In React components
function MyComponent() {
  const flags = useFeatureFlags()
  
  if (flags.autologin) {
    // Feature-specific logic
  }
}

// Direct feature checking
if (isFeatureEnabled('autologin')) {
  // Feature logic
}

// Server-side checking
import { isFeatureEnabledServer } from '@/lib/feature-flags'

if (isFeatureEnabledServer('autologin')) {
  // Server logic
}
```

## Available Feature Flags

### Autologin (`autologin`)

**Environment Variable**: `NEXT_PUBLIC_FEATURE_AUTOLOGIN=true`

Enables automatic login functionality for testing purposes.

**Behavior**:
1. When visiting the login page, shows "Iniciando autologin..." message for 1 second
2. Automatically logs in with hardcoded test credentials:
   - Email: `admin@movimientoconsolacion.com`
   - Password: `1234`
3. Reloads the page after successful login to ensure proper session handling

**Use Cases**:
- Development testing
- Demo environments
- Automated testing workflows

## Vercel Deployment

### Setting Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add your feature flags:
   ```
   NEXT_PUBLIC_FEATURE_AUTOLOGIN = true
   ```
4. Choose the appropriate environments (Production, Preview, Development)
5. Redeploy your application

### Different Environments

You can set different feature flag values for different environments:

- **Production**: Stable features only
- **Preview**: Testing new features
- **Development**: All experimental features

Example Vercel configuration:
```
# Production
NEXT_PUBLIC_FEATURE_AUTOLOGIN = false

# Preview/Development  
NEXT_PUBLIC_FEATURE_AUTOLOGIN = true
```

## Adding New Feature Flags

1. **Update the interface** in `lib/feature-flags.ts`:
   ```typescript
   export interface FeatureFlags {
     autologin: boolean;
     newFeature: boolean; // Add your new flag
   }
   ```

2. **Update the flag reading logic**:
   ```typescript
   function getFeatureFlags(): FeatureFlags {
     const autologin = process.env.NEXT_PUBLIC_FEATURE_AUTOLOGIN === 'true';
     const newFeature = process.env.NEXT_PUBLIC_FEATURE_NEW_FEATURE === 'true';

     return {
       autologin,
       newFeature,
     };
   }
   ```

3. **Add constants** (optional):
   ```typescript
   export const FEATURE_FLAGS = {
     AUTOLOGIN: 'autologin' as const,
     NEW_FEATURE: 'newFeature' as const,
   } as const;
   ```

4. **Use in your components**:
   ```typescript
   const flags = useFeatureFlags()
   if (flags.newFeature) {
     // Your feature logic
   }
   ```

## Best Practices

1. **Use descriptive names**: `FEATURE_ENHANCED_SEARCH` vs `FEATURE_X`
2. **Default to false**: Features should be opt-in, not opt-out
3. **Document each flag**: Include purpose and expected behavior
4. **Clean up**: Remove unused feature flags from code and environment
5. **Test both states**: Ensure your app works with flags on and off
6. **Use TypeScript**: The system provides full type safety

## Security Considerations

- **Client-side flags** (`NEXT_PUBLIC_*`) are visible to users in the browser
- **Server-side flags** remain private on the server
- Don't use client-side flags for sensitive features
- Use server-side flags for business logic that should remain hidden

## Troubleshooting

### Feature flag not working
1. Check environment variable name (case-sensitive)
2. Ensure value is exactly `"true"` (string)
3. Restart development server after changing `.env.local`
4. For Vercel, ensure redeployment after env var changes

### TypeScript errors
1. Add new flags to the `FeatureFlags` interface
2. Update the `getFeatureFlags()` function
3. Run type checking: `npm run type-check`

### Build failures
1. Ensure all feature flags have fallback values
2. Test builds with flags both enabled and disabled
3. Check for unused imports when flags are disabled

## Examples

### Simple Feature Toggle
```typescript
// In a component
const flags = useFeatureFlags()

return (
  <div>
    {flags.newDashboard ? (
      <NewDashboard />
    ) : (
      <LegacyDashboard />
    )}
  </div>
)
```

### Server-side Feature
```typescript
// In an API route or server component
import { isFeatureEnabledServer } from '@/lib/feature-flags'

export async function GET() {
  if (isFeatureEnabledServer('advancedAnalytics')) {
    // Enhanced analytics logic
    return new Response(JSON.stringify(advancedData))
  }
  
  // Basic analytics
  return new Response(JSON.stringify(basicData))
}
```

### Conditional Imports
```typescript
// Dynamically import features
const flags = useFeatureFlags()

const Component = flags.newFeature 
  ? lazy(() => import('./NewFeatureComponent'))
  : lazy(() => import('./LegacyComponent'))
```