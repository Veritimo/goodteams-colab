import {
  Sparkles,
  Plus,
  Search,
  Settings2,
  ArrowLeft,
  Download,
  FolderOpen,
  CheckCircle,
  XCircle,
  Package,
  Wrench,
  FileCode,
  ExternalLink,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useState, useCallback } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";

// Types
interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  status: "enabled" | "disabled" | "error";
  source: "bundled" | "clawhub" | "local";
  tools: string[];
  dependencies?: string[];
  config?: Record<string, SkillConfigOption>;
  error?: string;
  installPath?: string;
  lastUpdated: string;
}

interface SkillConfigOption {
  type: "string" | "number" | "boolean" | "select";
  label: string;
  description?: string;
  default?: string | number | boolean;
  options?: string[];
  required?: boolean;
}

// Mock data
const mockSkills: Skill[] = [
  {
    id: "skill-browser",
    name: "Browser Automation",
    description:
      "Control web browsers for automation tasks, including navigation, clicking, and data extraction.",
    version: "1.2.0",
    author: "OpenClaw",
    status: "enabled",
    source: "bundled",
    tools: [
      "browser_navigate",
      "browser_click",
      "browser_type",
      "browser_screenshot",
      "browser_extract",
    ],
    config: {
      headless: {
        type: "boolean",
        label: "Headless Mode",
        description: "Run browser without visible window",
        default: true,
      },
      timeout: {
        type: "number",
        label: "Default Timeout",
        description: "Default timeout in seconds for browser operations",
        default: 30,
      },
    },
    lastUpdated: "2024-01-10T00:00:00Z",
  },
  {
    id: "skill-github",
    name: "GitHub Integration",
    description: "Interact with GitHub repositories, issues, pull requests, and actions.",
    version: "2.0.1",
    author: "OpenClaw",
    status: "enabled",
    source: "bundled",
    tools: ["github_repo", "github_issue", "github_pr", "github_actions"],
    config: {
      defaultOrg: {
        type: "string",
        label: "Default Organization",
        description: "Default GitHub organization to use",
      },
    },
    lastUpdated: "2024-01-12T00:00:00Z",
  },
  {
    id: "skill-slack",
    name: "Slack Messaging",
    description: "Send messages, manage channels, and interact with Slack workspaces.",
    version: "1.5.0",
    author: "OpenClaw",
    status: "disabled",
    source: "bundled",
    tools: ["slack_send", "slack_channel", "slack_thread"],
    config: {
      defaultChannel: {
        type: "string",
        label: "Default Channel",
        description: "Default Slack channel for messages",
      },
    },
    lastUpdated: "2024-01-08T00:00:00Z",
  },
  {
    id: "skill-database",
    name: "Database Query",
    description: "Execute SQL queries against PostgreSQL, MySQL, and SQLite databases.",
    version: "1.0.3",
    author: "Community",
    status: "enabled",
    source: "clawhub",
    tools: ["db_query", "db_execute", "db_schema"],
    dependencies: ["pg", "mysql2", "better-sqlite3"],
    config: {
      connectionString: {
        type: "string",
        label: "Connection String",
        description: "Database connection string (stored securely)",
        required: true,
      },
      maxConnections: {
        type: "number",
        label: "Max Connections",
        description: "Maximum number of connections in the pool",
        default: 10,
      },
    },
    lastUpdated: "2024-01-05T00:00:00Z",
  },
  {
    id: "skill-custom",
    name: "Custom Script Runner",
    description: "Execute custom Python and Node.js scripts with sandboxing.",
    version: "0.9.0",
    author: "Local",
    status: "error",
    source: "local",
    tools: ["run_python", "run_node"],
    installPath: "/home/user/.openclaw/skills/custom-runner",
    error: "Missing dependency: python3.11",
    lastUpdated: "2024-01-14T00:00:00Z",
  },
];

// Helper functions
function getSourceBadge(source: Skill["source"]) {
  switch (source) {
    case "bundled":
      return <Badge variant="default">Bundled</Badge>;
    case "clawhub":
      return <Badge variant="secondary">ClawHub</Badge>;
    case "local":
      return <Badge variant="outline">Local</Badge>;
  }
}

function getStatusIcon(status: Skill["status"]) {
  switch (status) {
    case "enabled":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "disabled":
      return <XCircle className="h-4 w-4 text-muted-foreground" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
  }
}

// Components
function SkillCard({
  skill,
  onSelect,
  onToggle,
}: {
  skill: Skill;
  onSelect: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onSelect}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{skill.name}</CardTitle>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={skill.status === "enabled"}
              onCheckedChange={onToggle}
              disabled={skill.status === "error"}
            />
          </div>
        </div>
        <CardDescription className="line-clamp-2">{skill.description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3" />v{skill.version}
          </span>
          <span className="flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            {skill.tools.length} tools
          </span>
        </div>
        {skill.status === "error" && (
          <div className="mt-2 text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {skill.error}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getSourceBadge(skill.source)}
          {getStatusIcon(skill.status)}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          <Settings2 className="h-4 w-4 mr-1" />
          Configure
        </Button>
      </CardFooter>
    </Card>
  );
}

function SkillDetail({
  skill,
  onBack,
  onToggle,
  onSaveConfig,
}: {
  skill: Skill;
  onBack: () => void;
  onToggle: (enabled: boolean) => void;
  onSaveConfig: (config: Record<string, unknown>) => void;
}) {
  const [configValues, setConfigValues] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    onSaveConfig(configValues);
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{skill.name}</h2>
              {getSourceBadge(skill.source)}
            </div>
            <p className="text-muted-foreground">{skill.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {skill.status === "enabled" ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={skill.status === "enabled"}
              onCheckedChange={onToggle}
              disabled={skill.status === "error"}
            />
          </div>
        </div>
      </div>

      {skill.status === "error" && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800 dark:text-red-200">Skill Error</h4>
                <p className="text-sm text-red-600 dark:text-red-300">{skill.error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Version</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="font-medium">{skill.version}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Author</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="font-medium">{skill.author}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tools</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="font-medium">{skill.tools.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Updated</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="font-medium">{new Date(skill.lastUpdated).toLocaleDateString()}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Tools</CardTitle>
          <CardDescription>Tools provided by this skill</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {skill.tools.map((tool) => (
              <Badge key={tool} variant="outline" className="font-mono text-sm">
                <FileCode className="h-3 w-3 mr-1" />
                {tool}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {skill.dependencies && skill.dependencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dependencies</CardTitle>
            <CardDescription>Required packages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {skill.dependencies.map((dep) => (
                <Badge key={dep} variant="secondary" className="font-mono text-sm">
                  <Package className="h-3 w-3 mr-1" />
                  {dep}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {skill.config && Object.keys(skill.config).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Customize skill behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(skill.config).map(([key, option]) => (
              <div key={key} className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  {option.label}
                  {option.required && <span className="text-red-500">*</span>}
                </label>
                {option.description && (
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                )}
                {option.type === "boolean" ? (
                  <Switch
                    checked={(configValues[key] as boolean) ?? (option.default as boolean) ?? false}
                    onCheckedChange={(checked) =>
                      setConfigValues((prev) => ({ ...prev, [key]: checked }))
                    }
                  />
                ) : option.type === "number" ? (
                  <Input
                    type="number"
                    value={(configValues[key] as number) ?? (option.default as number) ?? ""}
                    onChange={(e) =>
                      setConfigValues((prev) => ({ ...prev, [key]: parseInt(e.target.value, 10) }))
                    }
                    className="max-w-xs"
                  />
                ) : (
                  <Input
                    type="text"
                    value={(configValues[key] as string) ?? (option.default as string) ?? ""}
                    onChange={(e) =>
                      setConfigValues((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="max-w-md"
                  />
                )}
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
          </CardFooter>
        </Card>
      )}

      {skill.installPath && (
        <Card>
          <CardHeader>
            <CardTitle>Install Location</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-sm bg-muted px-2 py-1 rounded">{skill.installPath}</code>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InstallSkillDialog({
  open,
  onOpenChange,
  onInstall,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: (source: "clawhub" | "local", value: string) => void;
}) {
  const [installSource, setInstallSource] = useState<"clawhub" | "local">("clawhub");
  const [searchQuery, setSearchQuery] = useState("");
  const [localPath, setLocalPath] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Install Skill</DialogTitle>
          <DialogDescription>Install a skill from ClawHub or a local path</DialogDescription>
        </DialogHeader>

        <Tabs
          value={installSource}
          onValueChange={(v) => setInstallSource(v as "clawhub" | "local")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="clawhub">
              <Download className="h-4 w-4 mr-2" />
              ClawHub
            </TabsTrigger>
            <TabsTrigger value="local">
              <FolderOpen className="h-4 w-4 mr-2" />
              Local Path
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clawhub" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search skills on ClawHub..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="h-48 border rounded-lg flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Search for skills to install</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="local" className="space-y-4">
            <div>
              <label className="text-sm font-medium">Skill Path</label>
              <p className="text-xs text-muted-foreground mb-2">
                Enter the path to a skill folder containing SKILL.md
              </p>
              <Textarea
                placeholder="/path/to/skill"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onInstall(installSource, installSource === "clawhub" ? searchQuery : localPath);
              onOpenChange(false);
            }}
            disabled={installSource === "clawhub" ? !searchQuery : !localPath}
          >
            Install Skill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Skills() {
  const [skills, setSkills] = useState<Skill[]>(mockSkills);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [isInstallOpen, setIsInstallOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState<"all" | Skill["source"]>("all");

  const handleToggleSkill = useCallback((id: string, enabled: boolean) => {
    setSkills((prev) =>
      prev.map((skill) =>
        skill.id === id ? { ...skill, status: enabled ? "enabled" : "disabled" } : skill,
      ),
    );
  }, []);

  const handleInstallSkill = useCallback((source: "clawhub" | "local", value: string) => {
    console.log("Installing skill:", source, value);
    // In real implementation, this would call the API to install the skill
  }, []);

  const handleSaveConfig = useCallback((skillId: string, config: Record<string, unknown>) => {
    console.log("Saving config for skill:", skillId, config);
    // In real implementation, this would call the API to save the config
  }, []);

  const filteredSkills = skills.filter((skill) => {
    const matchesSearch =
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = filterSource === "all" || skill.source === filterSource;
    return matchesSearch && matchesSource;
  });

  if (selectedSkill) {
    return (
      <SkillDetail
        skill={selectedSkill}
        onBack={() => setSelectedSkill(null)}
        onToggle={(enabled) => {
          handleToggleSkill(selectedSkill.id, enabled);
          setSelectedSkill({
            ...selectedSkill,
            status: enabled ? "enabled" : "disabled",
          });
        }}
        onSaveConfig={(config) => handleSaveConfig(selectedSkill.id, config)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Skills</h1>
        </div>
        <Button onClick={() => setIsInstallOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Install Skill
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Skills</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{skills.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Enabled</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-green-500">
              {skills.filter((s) => s.status === "enabled").length}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tools</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {skills.reduce((acc, s) => acc + s.tools.length, 0)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Errors</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-red-500">
              {skills.filter((s) => s.status === "error").length}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filterSource === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterSource("all")}
          >
            All
          </Button>
          <Button
            variant={filterSource === "bundled" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterSource("bundled")}
          >
            Bundled
          </Button>
          <Button
            variant={filterSource === "clawhub" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterSource("clawhub")}
          >
            ClawHub
          </Button>
          <Button
            variant={filterSource === "local" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterSource("local")}
          >
            Local
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSkills.map((skill) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            onSelect={() => setSelectedSkill(skill)}
            onToggle={(enabled) => handleToggleSkill(skill.id, enabled)}
          />
        ))}
      </div>

      {filteredSkills.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No skills found matching your criteria</p>
        </div>
      )}

      <InstallSkillDialog
        open={isInstallOpen}
        onOpenChange={setIsInstallOpen}
        onInstall={handleInstallSkill}
      />
    </div>
  );
}
