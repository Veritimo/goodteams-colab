import {
  Users as UsersIcon,
  Plus,
  MoreHorizontal,
  Mail,
  Shield,
  Trash2,
  Loader2,
  RefreshCw,
  UserPlus,
  Filter,
  Clock,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../components/AuthProvider";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
  DropdownMenuLabel,
} from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  getUsers,
  updateUserRole,
  removeUser,
  createInvitation,
  getInvitations,
  revokeInvitation,
  type User,
  type Invitation,
} from "../lib/api";

const ROLES = [
  { value: "ADMIN", label: "Admin" },
  { value: "USER", label: "User" },
  { value: "BILLING", label: "Billing" },
  { value: "VIEWER", label: "Viewer" },
];

// Parse API error responses
function parseApiError(error: string): string {
  try {
    const parsed = JSON.parse(error);
    if (parsed.error?.message) {
      return parsed.error.message;
    }
    if (parsed.message) {
      return parsed.message;
    }
  } catch {
    // Not JSON, return as-is
  }
  return error;
}

// User-friendly error messages for admin continuity errors
function getAdminContinuityMessage(error: string): string {
  const lowerError = error.toLowerCase();

  if (lowerError.includes("last admin") && lowerError.includes("remove")) {
    return "Cannot remove the last admin. Promote another user to admin first.";
  }
  if (lowerError.includes("last admin") && lowerError.includes("demote")) {
    return "Cannot change the last admin's role. Promote another user to admin first.";
  }
  if (lowerError.includes("cannot remove yourself") || lowerError.includes("remove yourself")) {
    return "You cannot remove yourself from the organization. Ask another admin to remove you.";
  }
  if (lowerError.includes("admin_continuity")) {
    return "This action would leave the organization without an admin.";
  }

  return error;
}

export function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>("");

  // Modal states
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("USER");
  const [saving, setSaving] = useState(false);

  // Compute admin count and identify last admin
  const adminCount = useMemo(() => {
    return users.filter(
      (u) => u.role.toUpperCase() === "ADMIN" || u.role.toUpperCase() === "SUPER_ADMIN",
    ).length;
  }, [users]);

  const isLastAdmin = useCallback(
    (user: User) => {
      const isAdmin =
        user.role.toUpperCase() === "ADMIN" || user.role.toUpperCase() === "SUPER_ADMIN";
      return isAdmin && adminCount === 1;
    },
    [adminCount],
  );

  const isCurrentUser = useCallback(
    (user: User) => {
      return currentUser?.id === user.id || currentUser?.email === user.email;
    },
    [currentUser],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [usersResult, invitationsResult] = await Promise.all([getUsers(), getInvitations()]);

    if (usersResult.error) {
      setError(parseApiError(usersResult.error));
    } else {
      setUsers(usersResult.data ?? []);
    }

    if (!invitationsResult.error) {
      setInvitations(invitationsResult.data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setSaving(true);
    setError(null);
    const result = await createInvitation(inviteEmail.trim(), inviteRole);
    setSaving(false);

    if (result.error) {
      setError(parseApiError(result.error));
    } else {
      setSuccess(`Invitation sent to ${inviteEmail}`);
      setIsInviteModalOpen(false);
      setInviteEmail("");
      setInviteRole("USER");
      fetchData();
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  const handleRoleChange = async (user: User, newRole: string) => {
    // Prevent demoting the last admin
    if (isLastAdmin(user) && newRole !== "ADMIN") {
      setError("Cannot change the last admin's role. Promote another user to admin first.");
      setTimeout(() => setError(null), 5000);
      return;
    }

    setError(null);
    const result = await updateUserRole(user.id, newRole);

    if (result.error) {
      const errorMsg = parseApiError(result.error);
      setError(getAdminContinuityMessage(errorMsg));
      setTimeout(() => setError(null), 8000);
    } else {
      setSuccess(`Updated ${user.email} role to ${newRole}`);
      fetchData();
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  const handleRemoveUser = async () => {
    if (!selectedUser) return;

    setSaving(true);
    setError(null);
    const result = await removeUser(selectedUser.id);
    setSaving(false);

    if (result.error) {
      const errorMsg = parseApiError(result.error);
      setError(getAdminContinuityMessage(errorMsg));
      setIsRemoveModalOpen(false);
      setSelectedUser(null);
      setTimeout(() => setError(null), 8000);
    } else {
      setSuccess(`Removed ${selectedUser.email} from organization`);
      setIsRemoveModalOpen(false);
      setSelectedUser(null);
      fetchData();
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  const handleRevokeInvitation = async (invitation: Invitation) => {
    setError(null);
    const result = await revokeInvitation(invitation.id);

    if (result.error) {
      setError(parseApiError(result.error));
    } else {
      setSuccess(`Revoked invitation for ${invitation.email}`);
      fetchData();
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  const openRemoveModal = (user: User) => {
    // Check if this is a protected action
    if (isLastAdmin(user)) {
      setError("Cannot remove the last admin. Promote another user to admin first.");
      setTimeout(() => setError(null), 5000);
      return;
    }
    if (isCurrentUser(user)) {
      setError(
        "You cannot remove yourself from the organization. Ask another admin to remove you.",
      );
      setTimeout(() => setError(null), 5000);
      return;
    }

    setSelectedUser(user);
    setIsRemoveModalOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role.toUpperCase()) {
      case "ADMIN":
        return <Badge variant="default">Admin</Badge>;
      case "USER":
        return <Badge variant="secondary">User</Badge>;
      case "BILLING":
        return <Badge variant="outline">Billing</Badge>;
      case "VIEWER":
        return <Badge variant="outline">Viewer</Badge>;
      case "SUPER_ADMIN":
        return <Badge variant="destructive">Super Admin</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getActionRestrictionReason = (user: User): string | null => {
    if (isLastAdmin(user)) {
      return "Last admin - cannot remove or demote";
    }
    if (isCurrentUser(user)) {
      return "This is you";
    }
    return null;
  };

  const filteredUsers = filterRole
    ? users.filter((u) => u.role.toUpperCase() === filterRole)
    : users;

  const pendingInvitations = invitations.filter((i) => i.status.toLowerCase() === "pending");

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
          <UsersIcon className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Users</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsInviteModalOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
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

      {/* Admin count warning */}
      {adminCount === 1 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your organization has only one admin. Consider promoting another user to admin to ensure
            continuity of access.
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Pending Invitations ({pendingInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {invitation.invitedBy.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDate(invitation.expiresAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeInvitation(invitation)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Organization Members ({filteredUsers.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                options={[{ value: "", label: "All Roles" }, ...ROLES]}
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-[140px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No users found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const restriction = getActionRestrictionReason(user);
                  const userIsLastAdmin = isLastAdmin(user);
                  const userIsCurrentUser = isCurrentUser(user);

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{user.username || user.email}</p>
                              {userIsCurrentUser && (
                                <Badge variant="outline" className="text-xs">
                                  You
                                </Badge>
                              )}
                              {userIsLastAdmin && (
                                <Badge variant="warning" className="text-xs gap-1">
                                  <Shield className="h-3 w-3" />
                                  Last Admin
                                </Badge>
                              )}
                            </div>
                            {user.username && (
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {restriction && (
                              <>
                                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                                  <Info className="h-3 w-3" />
                                  {restriction}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {ROLES.map((role) => {
                              const isCurrent = user.role.toUpperCase() === role.value;
                              const wouldDemoteLastAdmin =
                                userIsLastAdmin && role.value !== "ADMIN";
                              const isDisabled = isCurrent || wouldDemoteLastAdmin;

                              return (
                                <DropdownMenuItem
                                  key={role.value}
                                  onClick={() => !isDisabled && handleRoleChange(user, role.value)}
                                  disabled={isDisabled}
                                  className={isDisabled ? "opacity-50 cursor-not-allowed" : ""}
                                >
                                  <Shield className="h-4 w-4 mr-2" />
                                  Set as {role.label}
                                  {wouldDemoteLastAdmin && !isCurrent && (
                                    <span className="ml-auto text-xs text-muted-foreground">
                                      (blocked)
                                    </span>
                                  )}
                                </DropdownMenuItem>
                              );
                            })}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={userIsLastAdmin || userIsCurrentUser}
                              className={
                                userIsLastAdmin || userIsCurrentUser
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }
                              onClick={() =>
                                !(userIsLastAdmin || userIsCurrentUser) && openRemoveModal(user)
                              }
                            >
                              <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                              <span
                                className={
                                  userIsLastAdmin || userIsCurrentUser ? "" : "text-destructive"
                                }
                              >
                                Remove from Org
                              </span>
                              {(userIsLastAdmin || userIsCurrentUser) && (
                                <span className="ml-auto text-xs text-muted-foreground">
                                  (blocked)
                                </span>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite User Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent onClose={() => setIsInviteModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>Send an invitation to join your organization</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                id="invite-role"
                options={ROLES}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={saving || !inviteEmail.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove User Confirmation Modal */}
      <Dialog open={isRemoveModalOpen} onOpenChange={setIsRemoveModalOpen}>
        <DialogContent onClose={() => setIsRemoveModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{selectedUser?.email}</strong> from this
              organization? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRemoveModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveUser} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
