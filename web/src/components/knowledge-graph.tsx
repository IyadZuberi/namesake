import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";
import { buildGraph, type NodeData } from "@/lib/graph";
import { gateMeaning, RULES } from "@/lib/rules";
import type { CaseFile } from "@/lib/types";
import { cn } from "@/lib/utils";

function CardNode({ data }: NodeProps) {
  const d = data as NodeData;
  return (
    <div
      className={cn(
        "w-[188px] rounded-lg border bg-white px-2.5 py-2 shadow-sm",
        d.decisive && "border-rose-800 ring-2 ring-rose-800/40",
        d.highlighted && "ring-2 ring-emerald-800",
        d.missing && "border-dashed border-amber-800",
        !d.decisive && d.result === "agreement" && "border-emerald-700",
        !d.decisive && d.result === "contradiction" && "border-rose-800",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-zinc-400" />
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{d.kind}</div>
      <div className="truncate text-[13px] font-medium leading-tight">{d.label}</div>
      {d.value ? <div className="truncate font-mono text-[10px] text-muted-foreground">{d.value}</div> : null}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-zinc-400" />
    </div>
  );
}

const nodeTypes: NodeTypes = { card: CardNode };

export function KnowledgeGraph({ item, highlightIds = [], focusId }: { item: CaseFile; highlightIds?: string[]; focusId?: string }) {
  const animate = useMemo(
    () => typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const model = useMemo(() => buildGraph(item, animate), [item, animate]);
  const [selected, setSelected] = useState(model.decisiveId);
  useEffect(() => {
    if (focusId && model.nodes.some((n) => n.id === focusId)) setSelected(focusId);
  }, [focusId, model]);
  const nodes = model.nodes.map((n) => ({
    ...n,
    data: { ...n.data, highlighted: highlightIds.includes(n.id) },
  }));
  const node = nodes.find((n) => n.id === selected) ?? nodes[0];
  const ruleText = RULES.find((r) => r.name === node?.data.rule || r.id === node?.data.rule)?.text;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground" aria-hidden="false">
        <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-6 bg-rose-800" /> Contradiction</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-6 bg-emerald-700" /> Agreement</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-6 bg-zinc-400" /> Link</span>
        <span>The rose ring is the decisive step. Tab to a node and press Enter.</span>
      </div>
      <div className="h-[560px] overflow-hidden rounded-xl border bg-[#fbfaf7]" role="group" aria-label={`Entity graph for ${item.case_id}`}>
        <ReactFlow
          nodes={nodes}
          edges={model.edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.45}
          maxZoom={1.4}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          nodesFocusable
          edgesFocusable
          proOptions={{ hideAttribution: false }}
          onNodeClick={(_, n) => setSelected(n.id)}
          onSelectionChange={({ nodes }) => {
            if (nodes[0]) setSelected(nodes[0].id);
          }}
        >
          <Background gap={18} size={1} color="#e4e0d6" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {node ? (
        <div id="node-detail" aria-live="polite" className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{node.data.kind}</p>
          <h3 className="text-base font-semibold">{node.data.label}</h3>
          <p className="mt-2 text-sm">
            {node.data.kind === "Gate" ? gateMeaning(node.data.result) : node.data.lines.map((l) => `${l.label}: ${l.value}`).join(". ")}
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {node.data.lines.map((line) => (
              <div key={line.label} className="flex gap-2 text-sm">
                <dt className="w-36 shrink-0 text-muted-foreground">{line.label}</dt>
                <dd className="font-mono text-[12px]">{line.value}</dd>
              </div>
            ))}
            {ruleText ? (
              <div className="flex gap-2 text-sm sm:col-span-2">
                <dt className="w-36 shrink-0 text-muted-foreground">Rule</dt>
                <dd>{ruleText}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
