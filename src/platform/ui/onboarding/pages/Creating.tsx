/**
 * Creating Page
 *
 * Loading state while the organization is being created after consent.
 * Polls for completion and redirects to setup wizard.
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const steps = [
  { id: "consent", label: "Verifying consent", duration: 1000 },
  { id: "org", label: "Creating organization", duration: 1500 },
  { id: "user", label: "Setting up admin account", duration: 1000 },
  { id: "ready", label: "Almost there...", duration: 500 },
];

export function Creating() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Check for error from callback
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  // Simulate progress and redirect
  useEffect(() => {
    if (error) return;

    const timers: NodeJS.Timeout[] = [];
    let totalDelay = 0;

    steps.forEach((step, index) => {
      totalDelay += step.duration;
      const timer = setTimeout(() => {
        setCurrentStep(index + 1);
      }, totalDelay);
      timers.push(timer);
    });

    // Final redirect
    const redirectTimer = setTimeout(() => {
      navigate("/onboarding/setup");
    }, totalDelay + 500);
    timers.push(redirectTimer);

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [navigate, error]);

  if (error) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Setup Failed</h1>
          <p className="text-muted-foreground">There was a problem setting up your organization.</p>
        </div>

        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
          {error}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate("/onboarding/consent")}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
          <a
            href="mailto:support@goodteams.ai"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-8">
      {/* Spinner */}
      <div className="relative w-20 h-20 mx-auto">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Setting up your organization</h1>
        <p className="text-muted-foreground">This will only take a moment...</p>
      </div>

      {/* Progress steps */}
      <div className="max-w-sm mx-auto space-y-3">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                isComplete
                  ? "bg-green-50 text-green-700"
                  : isCurrent
                    ? "bg-primary/5 text-foreground"
                    : "text-muted-foreground"
              }`}
            >
              {isComplete ? (
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              ) : isCurrent ? (
                <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-muted" />
              )}
              <span className="text-sm font-medium">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
