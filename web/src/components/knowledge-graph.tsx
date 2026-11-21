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
import { GH, principleForKind } from "@/lib/policy";
import { RULES } from "@/lib/rules";
import { Link } from "react-router-dom";
import type { CaseFile } from "@/lib/types";
import { cn } from "@/lib/utils";

function CardNode({ data }: NodeProps) {
  const d = data as NodeData;
  return (
      <div
        className={cn(
          "w-[188px] rounded-lg border px-2.5 py-2 shadow-sm",
        "bg-card text-card-foreground",
        d.decisive && "border-rose-500 ring-2 ring-rose-500/50",
        d.highlighted && "ring-2 ring-emerald-500",
        d.missing && "border-dashed border-amber-500",
        d.result === "agreement" && "border-emerald-500",
        d.result === "contradiction" && "border-rose-500",
        d.result === "blocked" && "border-amber-500",
        d.result === "unknown" && "border-zinc-500",
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
  const principle = node ? principleForKind(node.data.kind, node.data.label) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground" aria-hidden="false">
        <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-6 bg-rose-800" /> Contradiction</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-6 bg-emerald-700" /> Agreement</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-6 bg-amber-500" /> Blocked</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-6 bg-zinc-400" /> Unknown or link</span>
        <span>Sources fan into the customer and the listed person. The seven gates run side by side. Tab to a node and press Enter.</span>
      </div>
      <div className="h-[640px] overflow-hidden rounded-xl border bg-card/40" role="group" aria-label={`Entity graph for ${item.case_id}`}>
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
          <Background gap={18} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {node ? (
        <div id="node-detail" aria-live="polite" className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{node.data.kind}</p>
          <h3 className="text-base font-semibold">{node.data.label}</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Why</dt><dd>{node.data.why}</dd></div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Source</dt>
              <dd className="font-mono text-[12px]">
                {node.data.sourceFile.endsWith(".jsonl") ? (
                  <a className="underline" href={GH + "demo-data/firedrill/" + node.data.sourceFile}>{node.data.sourceFile}</a>
                ) : (
                  node.data.sourceFile
                )}
                {" · "}{node.data.sourceField}{node.data.sourceId ? " · " + node.data.sourceId : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Rule</dt>
              <dd>
                {principle ? <Link className="underline" to={"/policy#p-" + principle.n}>Principle {principle.n}. {principle.title}.</Link> : null}
                {" "}{ruleText || "This node is a source, not a deciding rule."}
              </dd>
            </div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Path</dt><dd>{node.data.path}</dd></div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
