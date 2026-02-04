/**
 * Welcome Page
 *
 * Landing page for organization onboarding.
 * Explains benefits and prompts IT admin to get started.
 */

import { useNavigate, Link } from "react-router-dom";
import { Button } from "../../admin/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../admin/components/ui/card";

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    title: "Enterprise Security",
    description: "SSO with Microsoft Entra, role-based access, full audit logging",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
        />
      </svg>
    ),
    title: "Connect Your Data",
    description: "Securely integrate with SQL Server, Salesforce, and more",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
    title: "AI-Powered Insights",
    description: "Let your team ask questions about your data in natural language",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
    title: "Team Collaboration",
    description: "Share insights and workflows across your organization",
  },
];

export function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Set up GoodTeams for your organization
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          Get your team up and running with AI-powered data insights in minutes. No technical
          expertise required.
        </p>
      </div>

      {/* Features grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {features.map((feature) => (
          <Card key={feature.title} className="bg-white/50 backdrop-blur">
            <CardContent className="flex gap-4 pt-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {feature.icon}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA */}
      <Card className="bg-white">
        <CardHeader className="text-center pb-2">
          <CardTitle>Ready to get started?</CardTitle>
          <CardDescription>
            You&apos;ll need IT admin privileges to complete the setup.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Button size="lg" onClick={() => navigate("consent")}>
            Get Started
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Button>
          <Link
            to="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Already have an account? Sign in
          </Link>
        </CardContent>
      </Card>

      {/* Trust badges */}
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground">Trusted by enterprise teams worldwide</p>
        <div className="flex items-center justify-center gap-6 text-muted-foreground/50">
          <span className="text-sm font-medium">SOC 2</span>
          <span className="text-sm font-medium">GDPR</span>
          <span className="text-sm font-medium">ISO 27001</span>
        </div>
      </div>
    </div>
  );
}
