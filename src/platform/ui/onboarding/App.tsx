/**
 * Onboarding App Component
 *
 * Routes for the organization onboarding flow.
 */

import { Routes, Route } from "react-router-dom";
import { OnboardingLayout } from "./components/OnboardingLayout";
import { Complete } from "./pages/Complete";
import { Consent } from "./pages/Consent";
import { Creating } from "./pages/Creating";
import { SetupWizard } from "./pages/SetupWizard";
import { Welcome } from "./pages/Welcome";

export function OnboardingApp() {
  return (
    <Routes>
      <Route element={<OnboardingLayout />}>
        <Route index element={<Welcome />} />
        <Route path="consent" element={<Consent />} />
        <Route path="creating" element={<Creating />} />
        <Route path="setup" element={<SetupWizard />} />
        <Route path="complete" element={<Complete />} />
      </Route>
    </Routes>
  );
}
