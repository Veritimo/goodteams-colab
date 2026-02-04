import { Settings as SettingsIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export function Settings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Platform settings coming soon. This page will allow you to:
          </p>
          <ul className="list-disc list-inside mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Configure global platform settings</li>
            <li>Manage authentication providers</li>
            <li>Set up email and notification settings</li>
            <li>Configure backup and recovery</li>
            <li>Manage API keys and webhooks</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
