import {
  Building2,
  Plus,
  Pencil,
  Users,
  Calendar,
  Loader2,
  RefreshCw,
  MoreHorizontal,
  Ban,
  CheckCircle,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Alert, AlertDescription } from "../../admin/components/ui/alert";
import { Badge } from "../../admin/components/ui/badge";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../admin/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../../admin/components/ui/dropdown-menu";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../admin/components/ui/table";
import {
  getAllOrganizations,
  createOrganization,
  updateOrganization,
  type Organization,
} from "../lib/api";

// Mock data for when API is not ready
const mockOrganizations: Organization[] = [
  {
    id: "1",
    name: "Acme Corporation",
    status: "active",
    subscriptionTier: "enterprise",
    memberCount: 156,
    externalTenantId: "acme-tenant-id",
    authorizedModels: ["gpt-4", "gpt-3.5-turbo"],
    defaultModelId: "gpt-4",
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-12-01T14:20:00Z",
  },
  {
    id: "2",
    name: "TechStart Inc",
    status: "active",
    subscriptionTier: "pro",
    memberCount: 23,
    externalTenantId: null,
    authorizedModels: ["gpt-3.5-turbo"],
    defaultModelId: "gpt-3.5-turbo",
    createdAt: "2024-06-20T08:00:00Z",
    updatedAt: "2024-11-28T09:15:00Z",
  },
  {
    id: "3",
    name: "Global Solutions Ltd",
    status: "active",
    subscriptionTier: "enterprise",
    memberCount: 89,
    externalTenantId: "global-tenant",
    authorizedModels: ["gpt-4", "gpt-4-turbo", "claude-3"],
    defaultModelId: "gpt-4-turbo",
    createdAt: "2024-03-10T14:45:00Z",
    updatedAt: "2024-12-02T11:00:00Z",
  },
  {
    id: "4",
    name: "InnovateLabs",
    status: "suspended",
    subscriptionTier: "free",
    memberCount: 5,
    externalTenantId: null,
    authorizedModels: ["gpt-3.5-turbo"],
    defaultModelId: null,
    createdAt: "2024-09-05T16:30:00Z",
    updatedAt: "2024-11-15T10:00:00Z",
  },
  {
    id: "5",
    name: "Enterprise Partners",
    status: "active",
    subscriptionTier: "enterprise",
    memberCount: 245,
    externalTenantId: "ep-tenant",
    authorizedModels: ["gpt-4", "gpt-4-turbo", "claude-3", "gemini-pro"],
    defaultModelId: "gpt-4",
    createdAt: "2024-02-01T09:00:00Z",
    updatedAt: "2024-12-03T08:30:00Z",
  },
];

export function Organizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgTenantId, setNewOrgTenantId] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getAllOrganizations();
    if (result.error) {
      // Use mock data if API fails
      setOrganizations(mockOrganizations);
    } else {
      setOrganizations(result.data ?? mockOrganizations);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleEditClick = (org: Organization) => {
    setSelectedOrg(org);
    setEditName(org.name);
    setIsEditModalOpen(true);
  };

  const handleRowClick = (org: Organization) => {
    setSelectedOrg(org);
    setIsDetailModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedOrg || !editName.trim()) return;

    setSaving(true);
    const result = await updateOrganization(selectedOrg.id, { name: editName.trim() });
    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      setIsEditModalOpen(false);
      fetchOrganizations();
    }
  };

  const handleCreate = async () => {
    if (!newOrgName.trim()) return;

    setSaving(true);
    const result = await createOrganization({
      name: newOrgName.trim(),
      externalTenantId: newOrgTenantId.trim() || undefined,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      setIsCreateModalOpen(false);
      setNewOrgName("");
      setNewOrgTenantId("");
      fetchOrganizations();
    }
  };

  const handleStatusChange = async (org: Organization, newStatus: "active" | "suspended") => {
    const result = await updateOrganization(org.id, { status: newStatus });
    if (result.error) {
      setError(result.error);
    } else {
      fetchOrganizations();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "suspended":
        return <Badge variant="warning">Suspended</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "enterprise":
        return <Badge variant="default">Enterprise</Badge>;
      case "pro":
        return <Badge variant="secondary">Pro</Badge>;
      case "free":
        return <Badge variant="outline">Free</Badge>;
      default:
        return <Badge variant="outline">{tier}</Badge>;
    }
  };

  const filteredOrgs = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Organizations</h1>
          <Badge variant="secondary" className="ml-2">
            {organizations.length} total
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchOrganizations}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Organization
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" onDismiss={() => setError(null)}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search organizations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrgs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No organizations found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrgs.map((org) => (
                  <TableRow
                    key={org.id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(org)}
                  >
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>{getStatusBadge(org.status)}</TableCell>
                    <TableCell>{getTierBadge(org.subscriptionTier)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {org.memberCount}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {formatDate(org.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(org);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {org.status === "active" ? (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(org, "suspended");
                              }}
                              className="text-destructive"
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(org, "active");
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Organization Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent onClose={() => setIsCreateModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>Add a new customer organization to the platform</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-org-name">Organization Name</Label>
              <Input
                id="new-org-name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Enter organization name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-org-tenant">External Tenant ID (optional)</Label>
              <Input
                id="new-org-tenant"
                value={newOrgTenantId}
                onChange={(e) => setNewOrgTenantId(e.target.value)}
                placeholder="e.g., Azure AD tenant ID"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !newOrgName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent onClose={() => setIsEditModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>Update the organization settings</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter organization name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !editName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Organization Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent onClose={() => setIsDetailModalOpen(false)} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedOrg?.name}</DialogTitle>
            <DialogDescription>Organization details and configuration</DialogDescription>
          </DialogHeader>
          {selectedOrg && (
            <div className="py-4 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedOrg.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subscription Tier</p>
                  <div className="mt-1">{getTierBadge(selectedOrg.subscriptionTier)}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Members</p>
                  <p className="text-lg font-medium mt-1">{selectedOrg.memberCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="mt-1">{formatDate(selectedOrg.createdAt)}</p>
                </div>
              </div>

              {selectedOrg.externalTenantId && (
                <div>
                  <p className="text-sm text-muted-foreground">External Tenant ID</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded mt-1 inline-block">
                    {selectedOrg.externalTenantId}
                  </code>
                </div>
              )}

              {selectedOrg.defaultModelId && (
                <div>
                  <p className="text-sm text-muted-foreground">Default Model</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded mt-1 inline-block">
                    {selectedOrg.defaultModelId}
                  </code>
                </div>
              )}

              {selectedOrg.authorizedModels.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Authorized Models</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrg.authorizedModels.map((model) => (
                      <Badge key={model} variant="outline">
                        {model}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setIsDetailModalOpen(false);
                if (selectedOrg) handleEditClick(selectedOrg);
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
