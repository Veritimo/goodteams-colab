import { Settings, AlertTriangle, Bell, Shield, Flag, Save, Loader2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "../../admin/components/ui/alert";
import { Badge } from "../../admin/components/ui/badge";
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
import { Select } from "../../admin/components/ui/select";
import { Switch } from "../../admin/components/ui/switch";
import { Textarea } from "../../admin/components/ui/textarea";

// Mock settings
const mockSettings = {
  maintenanceMode: false,
  allowSignups: true,
  defaultSubscriptionTier: "free" as const,
  announcementBanner: null as string | null,
  featureFlags: {
    newWorkflowBuilder: true,
    aiAssistant: true,
    advancedAnalytics: false,
    customModels: true,
    multiLanguage: false,
  },
};

const featureFlagDescriptions: Record<string, string> = {
  newWorkflowBuilder: "Enable the new visual workflow builder (beta)",
  aiAssistant: "Enable AI-powered assistant in the chat interface",
  advancedAnalytics: "Enable advanced analytics dashboard",
  customModels: "Allow organizations to bring their own models",
  multiLanguage: "Enable multi-language support for the UI",
};

export function PlatformSettings() {
  const [settings, setSettings] = useState(mockSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState(settings.announcementBanner || "");

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const toggleFeatureFlag = (flag: string) => {
    setSettings((prev) => ({
      ...prev,
      featureFlags: {
        ...prev.featureFlags,
        [flag]: !prev.featureFlags[flag as keyof typeof prev.featureFlags],
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Platform Settings</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {saved && (
        <Alert className="bg-green-500/10 border-green-500/20">
          <AlertDescription className="text-green-500">
            Settings saved successfully
          </AlertDescription>
        </Alert>
      )}

      {/* System Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">System Status</CardTitle>
          </div>
          <CardDescription>Control platform-wide system settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Maintenance Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label className="font-medium">Maintenance Mode</Label>
                {settings.maintenanceMode && <Badge variant="warning">Active</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                When enabled, only Super Admins can access the platform
              </p>
            </div>
            <Switch
              checked={settings.maintenanceMode}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, maintenanceMode: checked }))
              }
            />
          </div>

          {settings.maintenanceMode && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Platform is in maintenance mode. All users except Super Admins are locked out.
              </AlertDescription>
            </Alert>
          )}

          {/* Allow Signups */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Allow New Signups</Label>
              <p className="text-sm text-muted-foreground">
                Allow new organizations to sign up for the platform
              </p>
            </div>
            <Switch
              checked={settings.allowSignups}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, allowSignups: checked }))
              }
            />
          </div>

          {/* Default Subscription Tier */}
          <div className="space-y-2">
            <Label className="font-medium">Default Subscription Tier</Label>
            <p className="text-sm text-muted-foreground">
              The subscription tier assigned to new organizations
            </p>
            <Select
              className="w-48"
              value={settings.defaultSubscriptionTier}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  defaultSubscriptionTier: e.target.value as "free" | "pro" | "enterprise",
                }))
              }
              options={[
                { value: "free", label: "Free" },
                { value: "pro", label: "Pro" },
                { value: "enterprise", label: "Enterprise" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Announcement Banner */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Announcement Banner</CardTitle>
          </div>
          <CardDescription>
            Display a banner message to all users across the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="announcement">Banner Message</Label>
            <Textarea
              id="announcement"
              placeholder="Enter an announcement message to display to all users..."
              value={announcementDraft}
              onChange={(e) => setAnnouncementDraft(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSettings((prev) => ({ ...prev, announcementBanner: announcementDraft || null }));
              }}
              disabled={!announcementDraft}
            >
              Set Banner
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAnnouncementDraft("");
                setSettings((prev) => ({ ...prev, announcementBanner: null }));
              }}
              disabled={!settings.announcementBanner}
            >
              Clear Banner
            </Button>
          </div>
          {settings.announcementBanner && (
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
              <p className="text-sm font-medium">Preview:</p>
              <p className="text-sm mt-1">{settings.announcementBanner}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Feature Flags</CardTitle>
          </div>
          <CardDescription>Enable or disable platform features globally</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(settings.featureFlags).map(([flag, enabled]) => (
              <div
                key={flag}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label className="font-medium capitalize">
                      {flag.replace(/([A-Z])/g, " $1").trim()}
                    </Label>
                    {enabled && <Badge variant="success">Enabled</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{featureFlagDescriptions[flag]}</p>
                </div>
                <Switch checked={enabled} onCheckedChange={() => toggleFeatureFlag(flag)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
