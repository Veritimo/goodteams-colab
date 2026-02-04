/**
 * Complete Page
 *
 * Success page shown after onboarding is complete.
 * Links to the admin panel.
 */

import { Link } from "react-router-dom";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent } from "../../admin/components/ui/card";

const nextSteps = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
    title: "Manage Users",
    description: "Invite more team members and manage roles",
    href: "/users",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
        />
      </svg>
    ),
    title: "Configure Connectors",
    description: "Set up connections to your data sources",
    href: "/connectors",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    ),
    title: "Build Workflows",
    description: "Create automated workflows for your team",
    href: "/workflows",
  },
];

export function Complete() {
  return (
    <div className="text-center space-y-8">
      {/* Success animation */}
      <div className="relative w-24 h-24 mx-auto">
        <div className="absolute inset-0 rounded-full bg-green-100 animate-ping opacity-25" />
        <div className="relative w-24 h-24 rounded-full bg-green-100 flex items-center justify-center">
          <svg
            className="w-12 h-12 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      {/* Message */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">You&apos;re all set!</h1>
        <p className="text-lg text-muted-foreground">
          Your organization is ready to use GoodTeams.
        </p>
      </div>

      {/* CTA */}
      <Button size="lg" asChild>
        <Link to="/">
          Go to Admin Panel
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Link>
      </Button>

      {/* Next steps */}
      <Card className="bg-white/50 text-left">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-foreground mb-4">What&apos;s next?</h3>
          <div className="space-y-3">
            {nextSteps.map((step) => (
              <Link
                key={step.href}
                to={step.href}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-white transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {step.icon}
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                <svg
                  className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors self-center"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Help link */}
      <p className="text-sm text-muted-foreground">
        Need help getting started?{" "}
        <a
          href="https://docs.goodteams.ai/getting-started"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Read our documentation
        </a>
      </p>
    </div>
  );
}
