import { GitBranch } from "lucide-react";
import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

export interface ConditionNodeData {
  label?: string;
  config?: {
    expression?: string;
    leftOperand?: string;
    operator?: string;
    rightOperand?: string;
  };
}

export const ConditionNode = memo(({ data, selected }: NodeProps<ConditionNodeData>) => {
  const expression = data?.config?.expression;
  const hasSimpleCondition = data?.config?.leftOperand && data?.config?.operator;

  // Build expression preview
  let expressionPreview = expression;
  if (!expressionPreview && hasSimpleCondition) {
    expressionPreview = `${data.config?.leftOperand} ${data.config?.operator} ${data.config?.rightOperand || "?"}`;
  }

  return (
    <div className="group relative" data-testid="condition-node">
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-orange-400 !border-2 !border-slate-800 shadow-sm"
        data-testid="condition-input-handle"
      />

      <div
        className={`px-4 py-3 shadow-lg rounded-xl bg-slate-800 border-2 transition-all min-w-[200px] ${
          selected
            ? "border-orange-500 ring-4 ring-orange-500/20 scale-105"
            : "border-slate-700 hover:border-orange-600/50"
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-orange-900/30 text-orange-400 shadow-sm border border-orange-900/50">
            <GitBranch size={18} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 leading-none mb-1">
              Condition
            </div>
            <div className="text-sm font-bold text-slate-100 truncate leading-none">
              {data?.label || "If / Else"}
            </div>
          </div>
        </div>

        {/* Expression preview */}
        {expressionPreview && (
          <div className="mt-2 text-[9px] font-mono text-orange-300/80 bg-orange-950/40 px-2 py-1 rounded border border-orange-900/50 truncate max-w-[180px]">
            {expressionPreview.length > 40
              ? `${expressionPreview.slice(0, 40)}...`
              : expressionPreview}
          </div>
        )}
      </div>

      {/* TRUE output handle */}
      <div className="absolute -right-3 top-3 flex items-center z-10">
        <span className="mr-2 text-[8px] font-bold text-green-400 uppercase tracking-wider bg-slate-900 border border-slate-700 px-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          True
        </span>
        <Handle
          type="source"
          position={Position.Right}
          id="true"
          className="!w-3 !h-3 !bg-green-500 !border-2 !border-slate-800 shadow-md hover:scale-125 transition-transform"
          style={{ top: "30%" }}
          data-testid="condition-true-handle"
        />
      </div>

      {/* FALSE output handle */}
      <div className="absolute -right-3 bottom-3 flex items-center z-10">
        <span className="mr-2 text-[8px] font-bold text-red-400 uppercase tracking-wider bg-slate-900 border border-slate-700 px-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          False
        </span>
        <Handle
          type="source"
          position={Position.Right}
          id="false"
          className="!w-3 !h-3 !bg-red-500 !border-2 !border-slate-800 shadow-md hover:scale-125 transition-transform"
          style={{ top: "70%" }}
          data-testid="condition-false-handle"
        />
      </div>
    </div>
  );
});

ConditionNode.displayName = "ConditionNode";

export default ConditionNode;
