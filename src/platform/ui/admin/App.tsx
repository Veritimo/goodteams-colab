import { Routes, Route } from "react-router-dom";
import { OnboardingApp } from "../onboarding";
import { Layout } from "./components/Layout";
import { AuditLogs } from "./pages/AuditLogs";
import { Connectors } from "./pages/Connectors";
import { Dashboard } from "./pages/Dashboard";
import { KnowledgeBase } from "./pages/KnowledgeBase";
import { Models } from "./pages/Models";
import { Settings } from "./pages/Settings";
import { Skills } from "./pages/Skills";
import { Users } from "./pages/Users";
import { Workflows } from "./pages/Workflows";

export function App() {
  return (
    <Routes>
      {/* Onboarding routes - no auth required */}
      <Route path="/onboarding/*" element={<OnboardingApp />} />

      {/* Admin routes - auth required, org-scoped */}
      <Route path="/admin" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="connectors" element={<Connectors />} />
        <Route path="workflows" element={<Workflows />} />
        <Route path="knowledge-base" element={<KnowledgeBase />} />
        <Route path="skills" element={<Skills />} />
        <Route path="models" element={<Models />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
