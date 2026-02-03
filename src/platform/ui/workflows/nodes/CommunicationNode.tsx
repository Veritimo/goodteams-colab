import { Mail, MessageSquare, Users, LucideIcon } from "lucide-react";
import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

export interface CommunicationNodeData {
  label?: string;
  config?: {
    method?: "email" | "teams" | "chat" | "slack";
    recipient?: string;
    subject?: string;
    template?: string;
  };
}

const methodIcons: Record<string, LucideIcon> = {
  email: Mail,
  teams: Users,
  chat: MessageSquare,
  slack: MessageSquare,
};

const methodLabels: Record<string, string> = {
  email: "Send Email",
  teams: "Teams Message",
  chat: "Chat Message",
  slack: "Slack Message",
};

export const CommunicationNode = memo(({ data, selected }: NodeProps<CommunicationNodeData>) => {
  const method = data?.config?.method || "email";
  const Icon = methodIcons[method] || Mail;
  const methodLabel = methodLabels[method] || "Communication";

  return (
    <div className="group relative" data-testid="communication-node">
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-purple-400 !border-2 !border-slate-800 shadow-sm"
        data-testid="communication-input-handle"
      />

      <div
        className={`px-4 py-3 shadow-lg rounded-xl bg-slate-800 border-2 transition-all min-w-[200px] ${
          selected
            ? "border-purple-500 ring-4 ring-purple-500/20 scale-105"
            : "border-slate-700 hover:border-purple-600/50"
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-purple-900/30 text-purple-400 shadow-sm border border-purple-900/50">
            <Icon size={18} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 leading-none mb-1">
              {methodLabel}
            </div>
            <div className="text-sm font-bold text-slate-100 truncate leading-none">
              {data?.label || "Send Message"}
            </div>
          </div>
        </div>

        {/* Recipient preview */}
        {data?.config?.recipient && (
          <div className="mt-1 text-[9px] font-bold text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded-full inline-block tracking-tight border border-purple-900/50 truncate max-w-[160px]">
            To: {data.config.recipient}
          </div>
        )}

        {/* Subject preview for email */}
        {method === "email" && data?.config?.subject && (
          <div className="mt-2 text-[9px] text-purple-300/80 bg-purple-950/40 px-2 py-1 rounded border border-purple-900/50 truncate max-w-[180px]">
            {data.config.subject}
          </div>
        )}
      </div>

      {/* Output handle (optional - for chaining) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-purple-600 !border-2 !border-slate-800 shadow-md hover:scale-125 transition-transform"
        data-testid="communication-output-handle"
      />
    </div>
  );
});

CommunicationNode.displayName = "CommunicationNode";

export default CommunicationNode;
