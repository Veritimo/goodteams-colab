/**
 * Consent Page
 *
 * Explains Microsoft Entra admin consent and initiates the flow.
 */

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../../admin/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../admin/components/ui/card";

const permissions = [
  {
    name: "Sign in and read user profile",
    description: "Read basic profile info of signed-in users",
    scope: "User.Read",
  },
  {
    name: "Read organization information",
    description: "Access your organization's tenant details",
    scope: "Organization.Read.All",
  },
  {
    name: "Read directory data",
    description: "List users and groups for team invitations",
    scope: "Directory.Read.All",
  },
];

export function Consent() {
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConsent = () => {
    setLoading(true);
    // Redirect to the onboarding consent endpoint (no auth required)
    // The backend will redirect to Microsoft's consent page
    window.location.href = `/api/platform/auth/entra/onboard?returnUrl=${encodeURIComponent("/onboarding/setup")}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Connect with Microsoft
        </h1>
        <p className="text-muted-foreground">
          Grant admin consent to integrate GoodTeams with your Microsoft 365 tenant.
        </p>
      </div>

      {/* Permissions card */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-lg">Permissions Requested</CardTitle>
          <CardDescription>
            GoodTeams requires the following permissions to function. All access is read-only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {permissions.map((perm) => (
            <div key={perm.scope} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <svg
                  className="w-4 h-4 text-green-600"
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
              <div>
                <p className="font-medium text-sm text-foreground">{perm.name}</p>
                <p className="text-xs text-muted-foreground">{perm.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* What happens next */}
      <Card className="bg-white/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-foreground mb-3">What happens next?</h3>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              You&apos;ll be redirected to Microsoft&apos;s consent page
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              Review and approve the permissions
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              Your organization is created automatically
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">
                4
              </span>
              Complete the setup wizard
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Admin confirmation */}
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-input text-primary focus:ring-primary"
        />
        <span className="text-sm text-foreground">
          I am an IT administrator authorized to grant consent on behalf of my organization.
        </span>
      </label>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Button
          size="lg"
          onClick={handleConsent}
          disabled={!confirmed || loading}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Connecting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21" fill="currentColor">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              Connect with Microsoft
            </>
          )}
        </Button>
        <Link
          to="/onboarding"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back
        </Link>
      </div>

      {/* Privacy note */}
      <p className="text-xs text-center text-muted-foreground">
        By continuing, you agree to our{" "}
        <a href="/terms" className="text-primary hover:underline">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
