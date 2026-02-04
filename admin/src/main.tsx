import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Org Admin imports
import { AuthProvider as OrgAuthProvider } from '@/components/AuthProvider';
import { App as OrgAdminApp } from '@/App';

// Platform Admin imports
import { AuthProvider as PlatformAuthProvider } from '@platform-admin/components/AuthProvider';
import { App as PlatformAdminApp } from '@platform-admin/App';

// Import both styles - they use CSS variables that will be applied based on context
import '@/styles.css';
import '@platform-admin/styles.css';

// Create a query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

/**
 * ThemeWrapper - Applies the correct theme based on the current route.
 */
function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isPlatformAdmin = location.pathname.startsWith('/platform-admin');

  useEffect(() => {
    // Apply dark theme for platform admin
    if (isPlatformAdmin) {
      document.documentElement.classList.add('dark', 'platform-admin');
      document.body.style.backgroundColor = 'oklch(0.145 0 0)';
      document.body.style.color = 'oklch(0.985 0 0)';
    } else {
      document.documentElement.classList.remove('dark', 'platform-admin');
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
    }
  }, [isPlatformAdmin]);

  return <>{children}</>;
}

// Onboarding imports (no auth required)
import { OnboardingApp } from '@onboarding/index';

/**
 * CombinedAdminApp - Routes to either Org Admin or Platform Admin based on URL path.
 *
 * - /admin/* → Org Admin (ADMIN role required)
 * - /platform-admin/* → Platform Admin (SUPER_ADMIN role required)
 * - /onboarding/* → Onboarding flow (no auth)
 */
function CombinedAdminApp() {
  const location = useLocation();

  // Platform Admin routes
  if (location.pathname.startsWith('/platform-admin')) {
    return (
      <PlatformAuthProvider>
        <PlatformAdminApp />
      </PlatformAuthProvider>
    );
  }

  // Onboarding routes (no auth required)
  if (location.pathname.startsWith('/onboarding')) {
    return <OnboardingApp />;
  }

  // Org Admin routes (default)
  return (
    <OrgAuthProvider>
      <OrgAdminApp />
    </OrgAuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeWrapper>
          <Routes>
            {/* Redirect root to org admin */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            
            {/* All other routes handled by CombinedAdminApp */}
            <Route path="/*" element={<CombinedAdminApp />} />
          </Routes>
        </ThemeWrapper>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
