import { Repeat } from "lucide-react";
import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

export interface IteratorNodeData {
  label?: string;
  config?: {
    collectionPath?: string;
    itemVariable?: string;
    maxIterations?: number;
  };
}

export const IteratorNode = memo(({ data, selected }: NodeProps<IteratorNodeData>) => {
  const collectionPath = data?.config?.collectionPath;
  const itemVariable = data?.config?.itemVariable || "item";

  return (
    <div className="group relative" data-testid="iterator-node">
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-pink-400 !border-2 !border-slate-800 shadow-sm"
        data-testid="iterator-input-handle"
      />

      <div
        className={`px-4 py-3 shadow-lg rounded-xl bg-slate-800 border-2 transition-all min-w-[200px] ${
          selected
            ? "border-pink-500 ring-4 ring-pink-500/20 scale-105"
            : "border-slate-700 hover:border-pink-600/50"
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-pink-900/30 text-pink-400 shadow-sm border border-pink-900/50">
            <Repeat size={18} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 leading-none mb-1">
              Iterator
            </div>
            <div className="text-sm font-bold text-slate-100 truncate leading-none">
              {data?.label || "For Each"}
            </div>
          </div>
        </div>

        {/* Item variable badge */}
        <div className="mt-1 text-[9px] font-bold text-pink-400 bg-pink-900/30 px-1.5 py-0.5 rounded-full inline-block uppercase tracking-tight border border-pink-900/50">
          as {itemVariable}
        </div>

        {/* Collection path preview */}
        {collectionPath && (
          <div className="mt-2 text-[9px] font-mono text-pink-300/80 bg-pink-950/40 px-2 py-1 rounded border border-pink-900/50 truncate max-w-[180px]">
            {collectionPath}
          </div>
        )}

        {/* Max iterations indicator */}
        {data?.config?.maxIterations && (
          <div className="mt-1 text-[8px] text-slate-400">
            Max: {data.config.maxIterations} iterations
          </div>
        )}
      </div>

      {/* Loop body output handle */}
      <div className="absolute -right-3 top-3 flex items-center z-10">
        <span className="mr-2 text-[8px] font-bold text-pink-400 uppercase tracking-wider bg-slate-900 border border-slate-700 px-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Loop
        </span>
        <Handle
          type="source"
          position={Position.Right}
          id="loop"
          className="!w-3 !h-3 !bg-pink-500 !border-2 !border-slate-800 shadow-md hover:scale-125 transition-transform"
          style={{ top: "30%" }}
          data-testid="iterator-loop-handle"
        />
      </div>

      {/* Done output handle */}
      <div className="absolute -right-3 bottom-3 flex items-center z-10">
        <span className="mr-2 text-[8px] font-bold text-green-400 uppercase tracking-wider bg-slate-900 border border-slate-700 px-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Done
        </span>
        <Handle
          type="source"
          position={Position.Right}
          id="done"
          className="!w-3 !h-3 !bg-green-500 !border-2 !border-slate-800 shadow-md hover:scale-125 transition-transform"
          style={{ top: "70%" }}
          data-testid="iterator-done-handle"
        />
      </div>
    </div>
  );
});

IteratorNode.displayName = "IteratorNode";

export default IteratorNode;
