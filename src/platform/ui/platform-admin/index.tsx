import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./components/AuthProvider";
import "./styles.css";

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
 * PlatformAdminApp - The platform administration panel for GoodTeams staff.
 *
 * This panel is restricted to SUPER_ADMIN users only and provides:
 * - Organization management across all customers
 * - Subscription and billing overview
 * - Platform-wide settings and feature flags
 * - System health monitoring
 *
 * @example
 * ```tsx
 * import { PlatformAdminApp } from './platform/ui/platform-admin';
 *
 * function App() {
 *   return <PlatformAdminApp />;
 * }
 * ```
 */
export function PlatformAdminApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// Export individual components for flexibility
export { App } from "./App";
export { Layout } from "./components/Layout";
export { Sidebar } from "./components/Sidebar";
export { Header } from "./components/Header";
export { AuthProvider, useAuth } from "./components/AuthProvider";
export { Dashboard } from "./pages/Dashboard";
export { Organizations } from "./pages/Organizations";
export { Subscriptions } from "./pages/Subscriptions";
export { PlatformSettings } from "./pages/PlatformSettings";
export { SystemHealth } from "./pages/SystemHealth";

// Export utilities
export { cn } from "./lib/utils";
export * from "./lib/api";
