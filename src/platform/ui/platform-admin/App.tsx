import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Organizations } from "./pages/Organizations";
import { PlatformSettings } from "./pages/PlatformSettings";
import { Subscriptions } from "./pages/Subscriptions";
import { SystemHealth } from "./pages/SystemHealth";

export function App() {
  return (
    <Routes>
      <Route path="/platform-admin" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="organizations" element={<Organizations />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="settings" element={<PlatformSettings />} />
        <Route path="health" element={<SystemHealth />} />
      </Route>
    </Routes>
  );
}
