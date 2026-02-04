import {
  BookOpen,
  Plus,
  RefreshCw,
  FileText,
  Calendar,
  Cloud,
  Upload,
  Link,
  FolderOpen,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Settings,
} from "lucide-react";
import { useState } from "react";
import type { KnowledgeCollection } from "../lib/api";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

// Mock data for stub UI
const MOCK_COLLECTIONS: KnowledgeCollection[] = [
  {
    id: "1",
    name: "Company Policies",
    description: "HR policies and employee handbooks",
    sourceType: "sharepoint",
    sourceUrl: "https://company.sharepoint.com/sites/hr",
    documentCount: 47,
    status: "ready",
    lastSyncAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    syncSchedule: "0 0 * * *", // Daily at midnight
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "2",
    name: "Technical Documentation",
    description: "Product documentation and technical specs",
    sourceType: "confluence",
    sourceUrl: "https://company.atlassian.net/wiki/spaces/DOCS",
    documentCount: 234,
    status: "syncing",
    lastSyncAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    syncSchedule: "0 */6 * * *", // Every 6 hours
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Training Materials",
    description: "Uploaded training documents and presentations",
    sourceType: "upload",
    sourceUrl: null,
    documentCount: 15,
    status: "ready",
    lastSyncAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    syncSchedule: null,
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "4",
    name: "Product Knowledge Base",
    description: "Customer-facing knowledge base articles",
    sourceType: "url",
    sourceUrl: "https://help.company.com",
    documentCount: 0,
    status: "error",
    lastSyncAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    syncSchedule: "0 0 * * 0", // Weekly on Sunday
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

const SOURCE_TYPES = {
  sharepoint: { label: "SharePoint", icon: Cloud, color: "text-blue-500" },
  confluence: { label: "Confluence", icon: FileText, color: "text-blue-600" },
  upload: { label: "File Upload", icon: Upload, color: "text-green-500" },
  url: { label: "Web URL", icon: Link, color: "text-purple-500" },
};

export function KnowledgeBase() {
  const [collections] = useState<KnowledgeCollection[]>(MOCK_COLLECTIONS);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleSync = async (collectionId: string) => {
    setSyncing(collectionId);
    // Simulate sync
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setSyncing(null);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Ready
          </Badge>
        );
      case "syncing":
        return (
          <Badge variant="default" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Syncing
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSourceIcon = (sourceType: keyof typeof SOURCE_TYPES) => {
    const config = SOURCE_TYPES[sourceType];
    if (!config) return <FolderOpen className="h-4 w-4" />;
    const Icon = config.icon;
    return <Icon className={`h-4 w-4 ${config.color}`} />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Knowledge Base</h1>
          <Badge variant="secondary" className="ml-2">
            Beta
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Collection
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <BookOpen className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                RAG Collections - Coming Soon
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Knowledge Base collections allow you to connect documents from SharePoint,
                Confluence, or uploaded files to enhance AI responses with your organization's
                knowledge. This feature is currently in development.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collections Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Collections ({collections.length})</CardTitle>
          <CardDescription>
            Document collections for retrieval-augmented generation (RAG)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Sync</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.map((collection) => (
                <TableRow key={collection.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{collection.name}</p>
                      {collection.description && (
                        <p className="text-sm text-muted-foreground">{collection.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getSourceIcon(collection.sourceType)}
                      <span className="text-sm">
                        {SOURCE_TYPES[collection.sourceType]?.label || collection.sourceType}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {collection.documentCount}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(collection.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {formatDate(collection.lastSyncAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSync(collection.id)}
                        disabled={syncing === collection.id || collection.status === "syncing"}
                      >
                        {syncing === collection.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" disabled>
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sync Schedule Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {collections.reduce((sum, c) => sum + c.documentCount, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Collections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {collections.filter((c) => c.status === "ready").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {collections.filter((c) => c.status === "error").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Create Collection Modal (Stub) */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent onClose={() => setIsCreateModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Create Collection</DialogTitle>
            <DialogDescription>
              Connect a new knowledge source to your organization
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-2">Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              The ability to create new knowledge base collections is currently in development.
              Check back soon for updates!
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
