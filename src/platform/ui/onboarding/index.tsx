/**
 * Onboarding UI Module
 *
 * Organization onboarding flow for new GoodTeams customers.
 * IT admins use this to:
 * 1. Grant Microsoft Entra admin consent
 * 2. Set up their organization
 * 3. Invite initial team members
 * 4. Configure data connectors
 */

export { OnboardingApp } from "./App";
export { OnboardingLayout } from "./components/OnboardingLayout";
export { StepIndicator } from "./components/StepIndicator";
export { Welcome } from "./pages/Welcome";
export { Consent } from "./pages/Consent";
export { Creating } from "./pages/Creating";
export { SetupWizard } from "./pages/SetupWizard";
export { Complete } from "./pages/Complete";
