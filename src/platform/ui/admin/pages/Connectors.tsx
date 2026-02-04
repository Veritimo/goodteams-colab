import {
  Database,
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Server,
  Cloud,
  Zap,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  getConnectors,
  createConnector,
  updateConnector,
  deleteConnector,
  testConnector,
  type Connector,
  type ConnectionType,
  type CreateConnectorRequest,
  type TestConnectionResult,
} from "../lib/api";

const CONNECTOR_TYPES: Array<{
  value: ConnectionType;
  label: string;
  description: string;
  icon: typeof Database;
}> = [
  {
    value: "SQL_SERVER",
    label: "SQL Server",
    description: "Microsoft SQL Server database",
    icon: Database,
  },
  {
    value: "POSTGRESQL",
    label: "PostgreSQL",
    description: "PostgreSQL database",
    icon: Database,
  },
  {
    value: "MYSQL",
    label: "MySQL",
    description: "MySQL database",
    icon: Database,
  },
  {
    value: "DATAVERSE",
    label: "Dataverse",
    description: "Microsoft Dataverse (Dynamics 365)",
    icon: Cloud,
  },
  {
    value: "SALESFORCE",
    label: "Salesforce",
    description: "Salesforce CRM",
    icon: Cloud,
  },
];

const WIZARD_STEPS = ["Select Type", "Configuration", "Test Connection", "Save"];

export function Connectors() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);

  // Wizard state
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardData, setWizardData] = useState<Partial<CreateConnectorRequest>>({});
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchConnectors = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getConnectors();
    if (result.error) {
      setError(result.error);
    } else {
      setConnectors(result.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  const resetWizard = () => {
    setWizardStep(0);
    setWizardData({});
    setTestResult(null);
    setTesting(false);
    setSaving(false);
  };

  const openWizard = () => {
    resetWizard();
    setIsWizardOpen(true);
  };

  const closeWizard = () => {
    setIsWizardOpen(false);
    resetWizard();
  };

  const handleTypeSelect = (type: ConnectionType) => {
    setWizardData({ ...wizardData, type, config: {}, credentials: {} });
    setWizardStep(1);
  };

  const handleTestConnection = async () => {
    if (!wizardData.type || !wizardData.name) return;

    setTesting(true);
    setTestResult(null);
    setError(null);

    // First create the connector
    const createResult = await createConnector(wizardData as CreateConnectorRequest);

    if (createResult.error) {
      setError(createResult.error);
      setTesting(false);
      return;
    }

    // Then test it
    const connector = createResult.data!;
    const testRes = await testConnector(connector.id);
    setTesting(false);

    if (testRes.error) {
      setError(testRes.error);
      // Delete the connector if test fails
      await deleteConnector(connector.id);
    } else {
      setTestResult(testRes.data!);
      setWizardData({ ...wizardData, id: connector.id });
    }
  };

  const handleSaveConnector = async () => {
    setSaving(true);
    // Connector was already created in test step, just close the wizard
    setSuccess(`Connector "${wizardData.name}" created successfully`);
    closeWizard();
    fetchConnectors();
    setTimeout(() => setSuccess(null), 5000);
    setSaving(false);
  };

  const handleDeleteConnector = async () => {
    if (!selectedConnector) return;

    setSaving(true);
    setError(null);
    const result = await deleteConnector(selectedConnector.id);
    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(`Connector "${selectedConnector.name}" deleted`);
      setIsDeleteModalOpen(false);
      setSelectedConnector(null);
      fetchConnectors();
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  const handleTestExisting = async (connector: Connector) => {
    setError(null);
    const result = await testConnector(connector.id);

    if (result.error) {
      setError(result.error);
    } else if (result.data?.success) {
      setSuccess(`Connection test passed (${result.data.latencyMs}ms)`);
      fetchConnectors();
      setTimeout(() => setSuccess(null), 5000);
    } else {
      setError(result.data?.message || "Connection test failed");
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONNECTED":
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Connected
          </Badge>
        );
      case "ERROR":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      case "PENDING":
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "DISABLED":
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Disabled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: ConnectionType) => {
    const config = CONNECTOR_TYPES.find((t) => t.value === type);
    const Icon = config?.icon ?? Database;
    return <Icon className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderWizardContent = () => {
    switch (wizardStep) {
      case 0: // Select Type
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {CONNECTOR_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  onClick={() => handleTypeSelect(type.value)}
                  className="flex items-start gap-4 p-4 rounded-lg border hover:border-primary hover:bg-accent transition-colors text-left"
                >
                  <div className="p-2 bg-muted rounded-md">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium">{type.label}</p>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        );

      case 1: // Configuration
        return (
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="conn-name">Connection Name *</Label>
              <Input
                id="conn-name"
                value={wizardData.name || ""}
                onChange={(e) => setWizardData({ ...wizardData, name: e.target.value })}
                placeholder="My Database Connection"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conn-desc">Description</Label>
              <Textarea
                id="conn-desc"
                value={wizardData.description || ""}
                onChange={(e) => setWizardData({ ...wizardData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            {(wizardData.type === "SQL_SERVER" ||
              wizardData.type === "POSTGRESQL" ||
              wizardData.type === "MYSQL") && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="conn-host">Host *</Label>
                    <Input
                      id="conn-host"
                      value={(wizardData.config as any)?.host || ""}
                      onChange={(e) =>
                        setWizardData({
                          ...wizardData,
                          config: { ...wizardData.config, host: e.target.value },
                        })
                      }
                      placeholder="localhost"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conn-port">Port</Label>
                    <Input
                      id="conn-port"
                      type="number"
                      value={(wizardData.config as any)?.port || ""}
                      onChange={(e) =>
                        setWizardData({
                          ...wizardData,
                          config: { ...wizardData.config, port: parseInt(e.target.value) },
                        })
                      }
                      placeholder={
                        wizardData.type === "SQL_SERVER"
                          ? "1433"
                          : wizardData.type === "POSTGRESQL"
                            ? "5432"
                            : "3306"
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conn-database">Database *</Label>
                  <Input
                    id="conn-database"
                    value={(wizardData.config as any)?.database || ""}
                    onChange={(e) =>
                      setWizardData({
                        ...wizardData,
                        config: { ...wizardData.config, database: e.target.value },
                      })
                    }
                    placeholder="my_database"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="conn-user">Username *</Label>
                    <Input
                      id="conn-user"
                      value={(wizardData.credentials as any)?.username || ""}
                      onChange={(e) =>
                        setWizardData({
                          ...wizardData,
                          credentials: { ...wizardData.credentials, username: e.target.value },
                        })
                      }
                      placeholder="db_user"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conn-pass">Password *</Label>
                    <Input
                      id="conn-pass"
                      type="password"
                      value={(wizardData.credentials as any)?.password || ""}
                      onChange={(e) =>
                        setWizardData({
                          ...wizardData,
                          credentials: { ...wizardData.credentials, password: e.target.value },
                        })
                      }
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </>
            )}

            {(wizardData.type === "DATAVERSE" || wizardData.type === "SALESFORCE") && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="conn-url">Instance URL *</Label>
                  <Input
                    id="conn-url"
                    value={(wizardData.config as any)?.instanceUrl || ""}
                    onChange={(e) =>
                      setWizardData({
                        ...wizardData,
                        config: { ...wizardData.config, instanceUrl: e.target.value },
                      })
                    }
                    placeholder={
                      wizardData.type === "DATAVERSE"
                        ? "https://org.crm.dynamics.com"
                        : "https://login.salesforce.com"
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conn-client">Client ID *</Label>
                  <Input
                    id="conn-client"
                    value={(wizardData.credentials as any)?.clientId || ""}
                    onChange={(e) =>
                      setWizardData({
                        ...wizardData,
                        credentials: { ...wizardData.credentials, clientId: e.target.value },
                      })
                    }
                    placeholder="Application/Client ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conn-secret">Client Secret *</Label>
                  <Input
                    id="conn-secret"
                    type="password"
                    value={(wizardData.credentials as any)?.clientSecret || ""}
                    onChange={(e) =>
                      setWizardData({
                        ...wizardData,
                        credentials: { ...wizardData.credentials, clientSecret: e.target.value },
                      })
                    }
                    placeholder="••••••••"
                  />
                </div>
              </>
            )}
          </div>
        );

      case 2: // Test Connection
        return (
          <div className="py-8 text-center">
            {testing ? (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                <p className="text-muted-foreground">Testing connection...</p>
              </div>
            ) : testResult ? (
              <div className="space-y-4">
                {testResult.success ? (
                  <>
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                    <p className="font-medium text-green-700">Connection Successful!</p>
                    <p className="text-sm text-muted-foreground">
                      Response time: {testResult.latencyMs}ms
                    </p>
                  </>
                ) : (
                  <>
                    <XCircle className="h-12 w-12 mx-auto text-destructive" />
                    <p className="font-medium text-destructive">Connection Failed</p>
                    <p className="text-sm text-muted-foreground">{testResult.message}</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  Click the button below to test your connection
                </p>
                <Button onClick={handleTestConnection}>
                  <Zap className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
              </div>
            )}
          </div>
        );

      case 3: // Save
        return (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <p className="font-medium">Ready to Save</p>
            <p className="text-sm text-muted-foreground">
              Your connector "{wizardData.name}" has been tested and is ready to use.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (wizardStep) {
      case 0:
        return false; // Type selection happens via click
      case 1:
        return !!wizardData.name?.trim();
      case 2:
        return testResult?.success;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Connectors</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchConnectors}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={openWizard}>
            <Plus className="h-4 w-4 mr-2" />
            Add Connector
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" onDismiss={() => setError(null)}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success" onDismiss={() => setSuccess(null)}>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {connectors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-medium mb-2">No connectors configured</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first data source to get started
            </p>
            <Button onClick={openWizard}>
              <Plus className="h-4 w-4 mr-2" />
              Add Connector
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connectors.map((connector) => (
            <Card key={connector.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-md">{getTypeIcon(connector.type)}</div>
                    <div>
                      <CardTitle className="text-base">{connector.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {CONNECTOR_TYPES.find((t) => t.value === connector.type)?.label ||
                          connector.type}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleTestExisting(connector)}>
                        <Zap className="h-4 w-4 mr-2" />
                        Test Connection
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedConnector(connector);
                          setIsEditModalOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onClick={() => {
                          setSelectedConnector(connector);
                          setIsDeleteModalOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    {getStatusBadge(connector.status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last Check</span>
                    <span className="text-sm">{formatDate(connector.lastHealthCheck)}</span>
                  </div>
                  {connector.description && (
                    <p className="text-sm text-muted-foreground pt-2 border-t">
                      {connector.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Connector Wizard Modal */}
      <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
        <DialogContent onClose={closeWizard} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Connector</DialogTitle>
            <DialogDescription>{WIZARD_STEPS[wizardStep]}</DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted rounded-lg">
            {WIZARD_STEPS.map((step, index) => (
              <div
                key={step}
                className={`flex items-center gap-2 ${
                  index <= wizardStep ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    index < wizardStep
                      ? "bg-primary text-primary-foreground"
                      : index === wizardStep
                        ? "bg-primary/20 text-primary border-2 border-primary"
                        : "bg-muted-foreground/20"
                  }`}
                >
                  {index < wizardStep ? <CheckCircle className="h-4 w-4" /> : index + 1}
                </div>
                <span className="text-sm hidden sm:inline">{step}</span>
              </div>
            ))}
          </div>

          {error && (
            <Alert variant="destructive" onDismiss={() => setError(null)}>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {renderWizardContent()}

          <DialogFooter>
            {wizardStep > 0 && (
              <Button
                variant="outline"
                onClick={() => setWizardStep(wizardStep - 1)}
                disabled={testing || saving}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            {wizardStep === 0 && (
              <Button variant="outline" onClick={closeWizard}>
                Cancel
              </Button>
            )}
            {wizardStep > 0 && wizardStep < 3 && (
              <Button
                onClick={() => setWizardStep(wizardStep + 1)}
                disabled={!canProceed() || testing}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {wizardStep === 3 && (
              <Button onClick={handleSaveConnector} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Connector
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent onClose={() => setIsDeleteModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Delete Connector</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedConnector?.name}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConnector} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
