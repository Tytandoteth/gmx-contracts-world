# Removing V2 Support

This guide explains how to remove GMX V2 support from the interface, focusing solely on V1 functionality for World Chain integration.

## Identifying V2 Components

First, identify all V2-specific components in your codebase:

- Version switcher components
- V2 context providers (usually `SyntheticsStateContext`, `SyntheticsEvents`, etc.)
- V2 hooks (`useV2Tokens`, `useSyntheticsState`, etc.)
- V2 data fetching utilities
- V2-specific UI components

## Step 1: Remove Version Switching UI

Look for components related to switching between V1 and V2, such as:

```tsx
// src/components/VersionSwitcher.tsx or similar
export function VersionSwitcher({ currentVersion, setVersion }) {
  return (
    <div className="version-switcher">
      <button
        className={currentVersion === "v1" ? "active" : ""}
        onClick={() => setVersion("v1")}
      >
        V1
      </button>
      <button
        className={currentVersion === "v2" ? "active" : ""}
        onClick={() => setVersion("v2")}
      >
        V2
      </button>
    </div>
  );
}
```

Remove these components and any state variables used for version switching:

```tsx
// Before
const [version, setVersion] = useState("v1");
// ...
<VersionSwitcher currentVersion={version} setVersion={setVersion} />

// After - Remove all of this code
```

## Step 2: Replace Version Context

Find your version context provider (often in `src/context/VersionContext.tsx` or similar):

```tsx
// src/context/V1OnlyContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';

// V1-only context
interface V1ContextType {
  version: 'v1';  // Always v1, no switching
}

const V1Context = createContext<V1ContextType>({ version: 'v1' });

export const V1Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <V1Context.Provider value={{ version: 'v1' }}>
      {children}
    </V1Context.Provider>
  );
};

export const useV1 = () => useContext(V1Context);

// For backward compatibility
export const useVersion = useV1;
```

## Step 3: Update App Component

Modify your App component to use only V1 providers:

```tsx
import { V1Provider } from './context/V1OnlyContext';

// Remove imports like:
// import { SyntheticsStateProvider } from './context/SyntheticsStateContext';

function App() {
  return (
    <ChainContextProvider>
      <Web3Provider>
        <V1Provider>
          <TokensProvider>
            <ContractsProvider>
              <PricesProvider>
                {/* No V2 providers needed */}
                <Router>
                  {/* Your routes */}
                </Router>
              </PricesProvider>
            </ContractsProvider>
          </TokensProvider>
        </V1Provider>
      </Web3Provider>
    </ChainContextProvider>
  );
}
```

## Step 4: Remove V2 Routes

Update your routes configuration:

```typescript
// src/routes.tsx or similar
const routes = [
  {
    path: "/",
    element: <Home />
  },
  {
    path: "/trade",
    element: <Exchange />
  },
  {
    path: "/dashboard",
    element: <Dashboard />
  },
  // Remove V2 specific routes like:
  // {
  //   path: "/v2/*",
  //   element: <V2Router />
  // },
];
```

## Step 5: Update Feature Flags

If your codebase uses feature flags to toggle functionality:

```typescript
// src/config/features.ts
export const FEATURES = {
  v1: true,
  v2: false, // Disable V2 completely
  
  // Other feature flags
  tradingView: true,
  orderHistory: true,
  // ...
};
```

## Step 6: Clean Up Imports and References

Search your codebase for references to V2 components and remove them:

```bash
# Find files containing V2 references
grep -r "v2" --include="*.tsx" --include="*.ts" src/
```

For each file with V2 references:
1. Remove unused imports
2. Remove conditional rendering based on version
3. Clean up unused code

Example of cleaning up a component:

```tsx
// Before
import { useVersion } from '../context/VersionContext';
import { V1Component } from './V1Component';
import { V2Component } from './V2Component';

export function TradeComponent() {
  const { version } = useVersion();
  
  return (
    <div>
      {version === 'v1' ? <V1Component /> : <V2Component />}
    </div>
  );
}

// After
import { V1Component } from './V1Component';

export function TradeComponent() {
  return (
    <div>
      <V1Component />
    </div>
  );
}
```

## Step 7: Test Navigation

After removing V2 components, test that all navigation works correctly:

1. Check that all links route to V1 components
2. Verify no V2 URLs are accessible
3. Ensure deep links work correctly

By following these steps, you'll remove all V2 functionality from your interface, creating a streamlined V1-only experience for your World Chain integration.
