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
 * AdminApp - The organization admin panel for customer org admins.
 *
 * This panel is for ADMIN role users to manage their organization:
 * - Team members and invitations
 * - Connectors and data sources
 * - Workflows and automations
 * - Knowledge base and skills
 * - Organization settings
 *
 * @example
 * ```tsx
 * import { AdminApp } from './platform/ui/admin';
 *
 * function App() {
 *   return <AdminApp />;
 * }
 * ```
 */
export function AdminApp() {
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

// Also export individual components for flexibility
export { App } from "./App";
export { Layout } from "./components/Layout";
export { Sidebar } from "./components/Sidebar";
export { Header } from "./components/Header";
export { AuthProvider, useAuth } from "./components/AuthProvider";
export { Dashboard } from "./pages/Dashboard";
export { Users } from "./pages/Users";
export { Connectors } from "./pages/Connectors";
export { Workflows } from "./pages/Workflows";
export { KnowledgeBase } from "./pages/KnowledgeBase";
export { Skills } from "./pages/Skills";
export { Models } from "./pages/Models";
export { AuditLogs } from "./pages/AuditLogs";
export { Settings } from "./pages/Settings";

// Export UI components
export { Button, buttonVariants } from "./components/ui/button";
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/ui/card";
export { Badge, badgeVariants } from "./components/ui/badge";
export { Input } from "./components/ui/input";
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./components/ui/table";

// Export utilities
export { cn } from "./lib/utils";
export * from "./lib/api";

// Export onboarding
export { OnboardingApp } from "../onboarding";
