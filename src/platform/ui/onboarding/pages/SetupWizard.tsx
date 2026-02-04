/**
 * Setup Wizard Page
 *
 * Multi-step wizard to configure the organization after consent:
 * 1. Organization Details
 * 2. Invite Team (optional)
 * 3. Connect Data (optional)
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../admin/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../admin/components/ui/card";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import { StepIndicator } from "../components/StepIndicator";

const WIZARD_STEPS = [
  { id: "org", label: "Organization" },
  { id: "team", label: "Invite Team" },
  { id: "data", label: "Connect Data" },
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

const DATA_CONNECTORS = [
  {
    id: "sql-server",
    name: "SQL Server",
    description: "Connect to Microsoft SQL Server databases",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zm0 18c-4.42 0-8-1.57-8-3.5v-2.03c1.76 1.15 4.62 1.78 8 1.78s6.24-.63 8-1.78v2.03c0 1.93-3.58 3.5-8 3.5zm0-5.75c-4.42 0-8-1.57-8-3.5v-2.03c1.76 1.15 4.62 1.78 8 1.78s6.24-.63 8-1.78v2.03c0 1.93-3.58 3.5-8 3.5zM12 9.5c-4.42 0-8-1.57-8-3.5S7.58 2.5 12 2.5s8 1.57 8 3.5-3.58 3.5-8 3.5z" />
      </svg>
    ),
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Connect to Salesforce CRM data",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10.05 5.82c.47-.8 1.32-1.35 2.31-1.35.86 0 1.62.4 2.13 1.02a3.05 3.05 0 013.87.67c1.18-.38 2.49-.15 3.44.67 1.4 1.2 1.55 3.3.35 4.7-.15.17-.31.33-.49.47a3.4 3.4 0 01-1.8 5.67 3.24 3.24 0 01-3.57 1.91 3.15 3.15 0 01-5.16 0A3.24 3.24 0 017.56 18a3.4 3.4 0 01-1.8-5.67c-.18-.14-.34-.3-.49-.47-1.2-1.4-1.05-3.5.35-4.7.95-.82 2.26-1.05 3.44-.67.51-.62 1.27-1.02 2.13-1.02.48 0 .93.14 1.32.35h-.46z" />
      </svg>
    ),
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    description: "Connect to PostgreSQL databases",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2z" />
      </svg>
    ),
  },
  {
    id: "dataverse",
    name: "Dataverse",
    description: "Connect to Microsoft Dataverse",
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
      </svg>
    ),
  },
];

interface OrgDetails {
  name: string;
  timezone: string;
  logo: File | null;
}

interface TeamMember {
  email: string;
  role: "ADMIN" | "USER" | "VIEWER";
}

export function SetupWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [orgDetails, setOrgDetails] = useState<OrgDetails>({
    name: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    logo: null,
  });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([{ email: "", role: "USER" }]);
  const [selectedConnectors, setSelectedConnectors] = useState<string[]>([]);

  // Pre-fill org name from query params
  useEffect(() => {
    const orgName = searchParams.get("org");
    if (orgName) {
      setOrgDetails((prev) => ({ ...prev, name: decodeURIComponent(orgName) }));
    }
  }, [searchParams]);

  const handleNext = async () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - save and complete
      await handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      // Save organization details
      await fetch("/api/platform/org", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgDetails.name,
          settings: { timezone: orgDetails.timezone },
        }),
      });

      // Invite team members (skip empty emails)
      const validMembers = teamMembers.filter((m) => m.email.trim());
      for (const member of validMembers) {
        await fetch("/api/platform/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: member.email, role: member.role }),
        });
      }

      navigate("/onboarding/complete");
    } catch (error) {
      console.error("Failed to complete setup:", error);
    } finally {
      setSaving(false);
    }
  };

  const addTeamMember = () => {
    setTeamMembers([...teamMembers, { email: "", role: "USER" }]);
  };

  const removeTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const updateTeamMember = (index: number, updates: Partial<TeamMember>) => {
    setTeamMembers(teamMembers.map((m, i) => (i === index ? { ...m, ...updates } : m)));
  };

  const toggleConnector = (id: string) => {
    setSelectedConnectors((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator steps={WIZARD_STEPS} currentStep={currentStep} />

      {/* Step content */}
      <Card className="bg-white">
        {currentStep === 0 && (
          <>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Confirm your organization information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={orgDetails.name}
                  onChange={(e) => setOrgDetails({ ...orgDetails, name: e.target.value })}
                  placeholder="Acme Corporation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  value={orgDetails.timezone}
                  onChange={(e) => setOrgDetails({ ...orgDetails, timezone: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Logo (optional)</Label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg border-2 border-dashed border-input flex items-center justify-center bg-muted">
                    {orgDetails.logo ? (
                      <img
                        src={URL.createObjectURL(orgDetails.logo)}
                        alt="Logo preview"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <svg
                        className="w-6 h-6 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setOrgDetails({
                        ...orgDetails,
                        logo: e.target.files?.[0] || null,
                      })
                    }
                    className="text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                </div>
              </div>
            </CardContent>
          </>
        )}

        {currentStep === 1 && (
          <>
            <CardHeader>
              <CardTitle>Invite Your Team</CardTitle>
              <CardDescription>
                Add team members to your organization. You can skip this and invite people later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {teamMembers.map((member, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="email"
                    value={member.email}
                    onChange={(e) => updateTeamMember(index, { email: e.target.value })}
                    placeholder="colleague@company.com"
                    className="flex-1"
                  />
                  <select
                    value={member.role}
                    onChange={(e) =>
                      updateTeamMember(index, {
                        role: e.target.value as TeamMember["role"],
                      })
                    }
                    className="w-32 h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  {teamMembers.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTeamMember(index)}
                    >
                      <svg
                        className="w-4 h-4"
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
                    </Button>
                  )}
                </div>
              ))}

              <Button type="button" variant="outline" onClick={addTeamMember}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Another
              </Button>
            </CardContent>
          </>
        )}

        {currentStep === 2 && (
          <>
            <CardHeader>
              <CardTitle>Connect Your Data</CardTitle>
              <CardDescription>
                Select data sources to connect. You can configure these in detail later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-3">
                {DATA_CONNECTORS.map((connector) => (
                  <button
                    key={connector.id}
                    type="button"
                    onClick={() => toggleConnector(connector.id)}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-colors ${
                      selectedConnectors.includes(connector.id)
                        ? "border-primary bg-primary/5"
                        : "border-input hover:border-muted-foreground/50"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        selectedConnectors.includes(connector.id)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {connector.icon}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{connector.name}</p>
                      <p className="text-xs text-muted-foreground">{connector.description}</p>
                    </div>
                    {selectedConnectors.includes(connector.id) && (
                      <svg
                        className="w-5 h-5 text-primary ml-auto shrink-0"
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
                    )}
                  </button>
                ))}
              </div>

              {selectedConnectors.length > 0 && (
                <p className="mt-4 text-sm text-muted-foreground">
                  {selectedConnectors.length} connector
                  {selectedConnectors.length !== 1 ? "s" : ""} selected. You can configure
                  connection details in the admin panel.
                </p>
              )}
            </CardContent>
          </>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {currentStep > 0 && (
            <Button variant="ghost" onClick={handleBack} disabled={saving}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 17l-5-5m0 0l5-5m-5 5h12"
                />
              </svg>
              Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentStep > 0 && (
            <Button variant="outline" onClick={handleSkip} disabled={saving}>
              Skip for now
            </Button>
          )}
          <Button onClick={handleNext} disabled={saving}>
            {saving ? (
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
                Saving...
              </>
            ) : currentStep === WIZARD_STEPS.length - 1 ? (
              "Complete Setup"
            ) : (
              <>
                Continue
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
