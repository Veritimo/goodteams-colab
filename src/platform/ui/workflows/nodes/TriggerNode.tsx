import { Zap, Clock, Webhook, MessageSquare, LucideIcon } from "lucide-react";
import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

export interface TriggerNodeData {
  label?: string;
  config?: {
    type?: "manual" | "cron" | "webhook" | "chat";
    schedule?: string;
    webhookPath?: string;
  };
}

const triggerIcons: Record<string, LucideIcon> = {
  manual: Zap,
  cron: Clock,
  webhook: Webhook,
  chat: MessageSquare,
};

const triggerLabels: Record<string, string> = {
  manual: "Manual Trigger",
  cron: "Scheduled",
  webhook: "Webhook",
  chat: "Chat Trigger",
};

export const TriggerNode = memo(({ data, selected }: NodeProps<TriggerNodeData>) => {
  const triggerType = data?.config?.type || "manual";
  const Icon = triggerIcons[triggerType] || Zap;
  const typeLabel = triggerLabels[triggerType] || "Trigger";

  return (
    <div className="group relative" data-testid="trigger-node">
      <div
        className={`px-4 py-3 shadow-lg rounded-xl bg-slate-800 border-2 transition-all min-w-[200px] ${
          selected
            ? "border-green-500 ring-4 ring-green-500/20 scale-105"
            : "border-slate-700 hover:border-green-600/50"
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-green-900/30 text-green-400 shadow-sm border border-green-900/50">
            <Icon size={18} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 leading-none mb-1">
              {typeLabel}
            </div>
            <div className="text-sm font-bold text-slate-100 truncate leading-none">
              {data?.label || "New Trigger"}
            </div>
          </div>
        </div>

        {/* Show schedule for cron triggers */}
        {triggerType === "cron" && data?.config?.schedule && (
          <div className="mt-2 text-[9px] font-mono text-green-300/80 bg-green-950/40 px-2 py-1 rounded border border-green-900/50 truncate">
            {data.config.schedule}
          </div>
        )}

        {/* Show path for webhook triggers */}
        {triggerType === "webhook" && data?.config?.webhookPath && (
          <div className="mt-2 text-[9px] font-mono text-green-300/80 bg-green-950/40 px-2 py-1 rounded border border-green-900/50 truncate">
            {data.config.webhookPath}
          </div>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-slate-800 shadow-md hover:scale-125 transition-transform"
        data-testid="trigger-output-handle"
      />
    </div>
  );
});

TriggerNode.displayName = "TriggerNode";

export default TriggerNode;
