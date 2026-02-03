import { Hammer } from "lucide-react";
import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

export interface ToolNodeData {
  label?: string;
  toolName?: string;
  config?: {
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export const ToolNode = memo(({ data, selected }: NodeProps<ToolNodeData>) => {
  const toolName = data?.toolName || data?.label || "Tool";
  const description = data?.config?.description;

  return (
    <div className="group relative" data-testid="tool-node">
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-rose-400 !border-2 !border-slate-800 shadow-sm"
        data-testid="tool-input-handle"
      />

      <div
        className={`px-4 py-3 shadow-lg rounded-xl bg-slate-800 border-2 transition-all min-w-[200px] ${
          selected
            ? "border-rose-500 ring-4 ring-rose-500/20 scale-105"
            : "border-slate-700 hover:border-rose-600/50"
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-rose-900/30 text-rose-400 shadow-sm border border-rose-900/50">
            <Hammer size={18} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 leading-none mb-1">
              Tool Execution
            </div>
            <div className="text-sm font-bold text-slate-100 truncate leading-none">{toolName}</div>
          </div>
        </div>

        {/* Tool action badge */}
        {data?.label && data.label !== toolName && (
          <div className="mt-1 text-[9px] font-bold text-rose-400 bg-rose-900/30 px-1.5 py-0.5 rounded-full inline-block uppercase tracking-tight border border-rose-900/50">
            {data.label}
          </div>
        )}

        {/* Description preview */}
        {description && (
          <div className="mt-2 text-[9px] text-rose-300/80 bg-rose-950/40 px-2 py-1 rounded border border-rose-900/50 truncate max-w-[180px]">
            {description.length > 60 ? `${description.slice(0, 60)}...` : description}
          </div>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-rose-600 !border-2 !border-slate-800 shadow-md hover:scale-125 transition-transform"
        data-testid="tool-output-handle"
      />
    </div>
  );
});

ToolNode.displayName = "ToolNode";

export default ToolNode;
