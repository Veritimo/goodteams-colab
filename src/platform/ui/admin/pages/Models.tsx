import { useQuery } from "@tanstack/react-query";
import {
  Brain,
  Plus,
  Settings2,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Star,
  AlertCircle,
  Loader2,
  DollarSign,
  Cpu,
  Key,
  RefreshCw,
  Trash2,
  Edit,
  Eye,
  EyeOff,
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
import { Select } from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { getModels } from "../lib/api";

// Types
interface ModelProvider {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "error";
  apiKeySet: boolean;
  baseUrl?: string;
  models: Model[];
  error?: string;
  lastChecked?: string;
}

interface Model {
  id: string;
  name: string;
  reasoning: boolean;
  inputTypes: ("text" | "image")[];
  contextWindow: number;
  maxTokens: number;
  cost: {
    input: number;
    output: number;
  };
}

interface ModelAlias {
  alias: string;
  targetProvider: string;
  targetModel: string;
}

interface UsageStats {
  provider: string;
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  period: string;
}

// Transform API models to providers (grouped by provider)
function transformModelsToProviders(apiModels: any[]): ModelProvider[] {
  if (!Array.isArray(apiModels) || apiModels.length === 0) {
    return [];
  }

  const providerMap = new Map<string, ModelProvider>();

  for (const model of apiModels) {
    const providerId = model.provider || "unknown";

    if (!providerMap.has(providerId)) {
      providerMap.set(providerId, {
        id: providerId,
        name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
        status: model.enabled ? "connected" : "disconnected",
        apiKeySet: model.enabled,
        models: [],
      });
    }

    const provider = providerMap.get(providerId)!;
    provider.models.push({
      id: model.id,
      name: model.name,
      reasoning: false,
      inputTypes: ["text"],
      contextWindow: 128000,
      maxTokens: 4096,
      cost: { input: 0, output: 0 },
    });
  }

  return Array.from(providerMap.values());
}

// Helper functions
function getStatusBadge(status: ModelProvider["status"]) {
  switch (status) {
    case "connected":
      return <Badge variant="success">Connected</Badge>;
    case "disconnected":
      return <Badge variant="secondary">Disconnected</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
  }
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

// Components
function ProviderCard({
  provider,
  isDefault,
  onConfigure,
  onSetDefault,
}: {
  provider: ModelProvider;
  isDefault: boolean;
  onConfigure: () => void;
  onSetDefault: () => void;
}) {
  return (
    <Card className={`${isDefault ? "ring-2 ring-primary" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{provider.name}</CardTitle>
            {isDefault && (
              <Badge variant="default" className="ml-2">
                <Star className="h-3 w-3 mr-1" />
                Default
              </Badge>
            )}
          </div>
          {getStatusBadge(provider.status)}
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Key className="h-4 w-4" />
            <span>API Key: {provider.apiKeySet ? "Configured" : "Not set"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Cpu className="h-4 w-4" />
            <span>{provider.models.length} models available</span>
          </div>
          {provider.error && (
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-4 w-4" />
              <span className="truncate">{provider.error}</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-2 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onConfigure}>
          <Settings2 className="h-4 w-4 mr-1" />
          Configure
        </Button>
        {!isDefault && provider.status === "connected" && (
          <Button variant="ghost" size="sm" onClick={onSetDefault}>
            <Star className="h-4 w-4 mr-1" />
            Set Default
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function ProviderDetail({
  provider,
  onBack,
  onSave,
}: {
  provider: ModelProvider;
  onBack: () => void;
  onSave: (apiKey: string, baseUrl?: string) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl || "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsTesting(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    onSave(apiKey, baseUrl);
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{provider.name}</h2>
            {getStatusBadge(provider.status)}
          </div>
          <p className="text-muted-foreground">Configure provider credentials and settings</p>
        </div>
      </div>

      {provider.error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800 dark:text-red-200">Connection Error</h4>
                <p className="text-sm text-red-600 dark:text-red-300">{provider.error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
          <CardDescription>API key and endpoint configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider.apiKeySet ? "••••••••••••••••" : "Enter API key"}
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Base URL (optional)</label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com"
            />
            <p className="text-xs text-muted-foreground">Leave empty to use the default endpoint</p>
          </div>
        </CardContent>
        <CardFooter className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Credentials
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={isTesting}>
            {isTesting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Test Connection
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Models</CardTitle>
          <CardDescription>Models available from this provider</CardDescription>
        </CardHeader>
        <CardContent>
          {provider.models.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No models available</p>
              <p className="text-sm">Configure credentials to load models</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Capabilities</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Max Output</TableHead>
                  <TableHead>Cost (per 1M tokens)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {provider.models.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{model.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{model.id}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {model.reasoning && <Badge variant="secondary">Reasoning</Badge>}
                        {model.inputTypes.includes("image") && (
                          <Badge variant="outline">Vision</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatTokens(model.contextWindow)}</TableCell>
                    <TableCell>{formatTokens(model.maxTokens)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="text-muted-foreground">In:</span> ${model.cost.input}
                        <span className="mx-2 text-muted-foreground">/</span>
                        <span className="text-muted-foreground">Out:</span> ${model.cost.output}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddProviderDialog({
  open,
  onOpenChange,
  existingProviders,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProviders: string[];
  onAdd: (providerId: string) => void;
}) {
  const [selectedProvider, setSelectedProvider] = useState("");

  const availableProviders = [
    { value: "anthropic", label: "Anthropic" },
    { value: "openai", label: "OpenAI" },
    { value: "google", label: "Google AI" },
    { value: "azure", label: "Azure OpenAI" },
    { value: "amazon-bedrock", label: "Amazon Bedrock" },
    { value: "groq", label: "Groq" },
    { value: "together", label: "Together AI" },
    { value: "mistral", label: "Mistral AI" },
  ].filter((p) => !existingProviders.includes(p.value));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Provider</DialogTitle>
          <DialogDescription>Add a new LLM provider to your configuration</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select
            options={availableProviders}
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            placeholder="Select a provider"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onAdd(selectedProvider);
              onOpenChange(false);
            }}
            disabled={!selectedProvider}
          >
            Add Provider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Models() {
  const { data: modelsResponse, isLoading } = useQuery({
    queryKey: ["org-models"],
    queryFn: getModels,
    staleTime: 30000,
  });

  // Transform API response to providers
  const apiProviders = Array.isArray(modelsResponse?.data)
    ? transformModelsToProviders(modelsResponse.data)
    : [];

  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [aliases, setAliases] = useState<ModelAlias[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider | null>(null);
  const [isAddProviderOpen, setIsAddProviderOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("providers");
  const [defaultProvider, setDefaultProvider] = useState("");

  // Update providers when API data loads
  const displayProviders = providers.length > 0 ? providers : apiProviders;

  const handleSetDefault = useCallback((providerId: string) => {
    setDefaultProvider(providerId);
  }, []);

  const handleSaveCredentials = useCallback(
    (providerId: string, apiKey: string, baseUrl?: string) => {
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? { ...p, apiKeySet: !!apiKey, baseUrl, status: apiKey ? "connected" : "disconnected" }
            : p,
        ),
      );
    },
    [],
  );

  const handleAddProvider = useCallback((providerId: string) => {
    const newProvider: ModelProvider = {
      id: providerId,
      name: providerId.charAt(0).toUpperCase() + providerId.slice(1).replace(/-/g, " "),
      status: "disconnected",
      apiKeySet: false,
      models: [],
    };
    setProviders((prev) => [...prev, newProvider]);
  }, []);

  // Usage stats would come from a separate API - show empty for now
  const usageStats: UsageStats[] = [];
  const totalCost = usageStats.reduce((acc, u) => acc + u.cost, 0);
  const totalRequests = usageStats.reduce((acc, u) => acc + u.requests, 0);

  if (selectedProvider) {
    return (
      <ProviderDetail
        provider={selectedProvider}
        onBack={() => setSelectedProvider(null)}
        onSave={(apiKey, baseUrl) => {
          handleSaveCredentials(selectedProvider.id, apiKey, baseUrl);
          setSelectedProvider(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Models</h1>
        </div>
        <Button onClick={() => setIsAddProviderOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Providers</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{displayProviders.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Connected</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-green-500">
              {displayProviders.filter((p) => p.status === "connected").length}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Requests (MTD)</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{totalRequests.toLocaleString()}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Cost (MTD)</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{formatCost(totalCost)}</span>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="aliases">Model Aliases</TabsTrigger>
          <TabsTrigger value="usage">Usage & Costs</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : displayProviders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Brain className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">No providers configured</p>
              <p className="text-sm mb-4">
                Add an LLM provider to get started with AI capabilities.
              </p>
              <Button onClick={() => setIsAddProviderOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Provider
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayProviders.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  isDefault={provider.id === defaultProvider}
                  onConfigure={() => setSelectedProvider(provider)}
                  onSetDefault={() => handleSetDefault(provider.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="aliases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Aliases</CardTitle>
              <CardDescription>
                Create shortcuts to reference models by friendly names
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aliases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Key className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No aliases configured</p>
                  <p className="text-xs">Create aliases to reference models by friendly names.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alias</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aliases.map((alias) => (
                      <TableRow key={alias.alias}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {alias.alias}
                          </Badge>
                        </TableCell>
                        <TableCell>{alias.targetProvider}</TableCell>
                        <TableCell className="font-mono text-sm">{alias.targetModel}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Alias
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage Statistics</CardTitle>
              <CardDescription>Token usage and costs by model (current month)</CardDescription>
            </CardHeader>
            <CardContent>
              {usageStats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <DollarSign className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No usage data yet</p>
                  <p className="text-xs">
                    Usage statistics will appear here once you start using the models.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Input Tokens</TableHead>
                      <TableHead className="text-right">Output Tokens</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageStats.map((usage, i) => (
                      <TableRow key={i}>
                        <TableCell>{usage.provider}</TableCell>
                        <TableCell className="font-mono text-sm">{usage.model}</TableCell>
                        <TableCell className="text-right">
                          {usage.requests.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatTokens(usage.inputTokens)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatTokens(usage.outputTokens)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCost(usage.cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">{totalRequests.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {formatTokens(usageStats.reduce((acc, u) => acc + u.inputTokens, 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTokens(usageStats.reduce((acc, u) => acc + u.outputTokens, 0))}
                      </TableCell>
                      <TableCell className="text-right">{formatCost(totalCost)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddProviderDialog
        open={isAddProviderOpen}
        onOpenChange={setIsAddProviderOpen}
        existingProviders={displayProviders.map((p) => p.id)}
        onAdd={handleAddProvider}
      />
    </div>
  );
}
