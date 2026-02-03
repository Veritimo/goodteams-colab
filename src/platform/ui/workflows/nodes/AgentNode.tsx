import { Brain } from "lucide-react";
import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

export interface AgentNodeData {
  label?: string;
  config?: {
    modelName?: string;
    prompt?: string;
    temperature?: number;
  };
}

export const AgentNode = memo(({ data, selected }: NodeProps<AgentNodeData>) => {
  const modelName = data?.config?.modelName;
  const prompt = data?.config?.prompt;

  return (
    <div className="group relative" data-testid="agent-node">
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-slate-800 shadow-sm"
        data-testid="agent-input-handle"
      />

      <div
        className={`px-4 py-3 shadow-lg rounded-xl bg-slate-800 border-2 transition-all min-w-[200px] ${
          selected
            ? "border-blue-500 ring-4 ring-blue-500/20 scale-105"
            : "border-slate-700 hover:border-blue-600/50"
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-blue-900/30 text-blue-400 shadow-sm border border-blue-900/50">
            <Brain size={18} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 leading-none mb-1">
              AI Agent
            </div>
            <div className="text-sm font-bold text-slate-100 truncate leading-none">
              {data?.label || "Assistant"}
            </div>
          </div>
        </div>

        {/* Model badge */}
        {modelName && (
          <div className="mt-1 text-[9px] font-bold text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded-full inline-block uppercase tracking-tight border border-blue-900/50">
            {modelName}
          </div>
        )}

        {/* Prompt preview */}
        {prompt && (
          <div className="mt-2 text-[9px] font-mono text-blue-300/80 bg-blue-950/40 px-2 py-1 rounded border border-blue-900/50 truncate max-w-[180px]">
            {prompt.length > 50 ? `${prompt.slice(0, 50)}...` : prompt}
          </div>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-600 !border-2 !border-slate-800 shadow-md hover:scale-125 transition-transform"
        data-testid="agent-output-handle"
      />
    </div>
  );
});

AgentNode.displayName = "AgentNode";

export default AgentNode;
