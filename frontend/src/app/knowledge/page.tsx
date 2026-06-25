"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { KnowledgePoint } from "@/lib/types";
import { KpCard } from "@/components/knowledge/kp-card";
import { Select } from "@/components/ui/select";

const STATUS_FILTERS: Array<{ label: string; value: string }> = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Edited", value: "edited" },
  { label: "Rejected", value: "rejected" },
];

function KnowledgeReviewContent() {
  const params = useSearchParams();
  const initialDocId = params.get("document_id");
  const [docFilter, setDocFilter] = useState<string>(initialDocId ?? "");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const qc = useQueryClient();
  const { data: kps, isLoading } = useQuery({
    queryKey: ["knowledge-points", docFilter, statusFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (docFilter) qs.set("document_id", docFilter);
      if (statusFilter) qs.set("status", statusFilter);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return api<KnowledgePoint[]>(`/api/knowledge-points${suffix}`);
    },
  });

  const update = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Record<string, unknown>;
    }) =>
      api<KnowledgePoint>(`/api/knowledge-points/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge-points"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const documents = useMemo(() => {
    const m = new Map<number, string>();
    (kps ?? []).forEach((kp) => m.set(kp.document_id, kp.document_title));
    return Array.from(m.entries()).map(([id, title]) => ({ id, title }));
  }, [kps]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Knowledge review</h1>
        <p className="mt-1 text-muted-foreground">
          AI-extracted knowledge points. Approve, edit, or reject before using them for assessments.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={docFilter}
          onChange={(e) => setDocFilter(e.target.value)}
          className="w-[260px]"
        >
          <option value="">All documents</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-[160px]"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : kps && kps.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {kps.map((kp) => (
            <KpCard
              key={kp.id}
              kp={kp}
              busy={update.isPending && update.variables?.id === kp.id}
              onUpdate={(id, payload) => update.mutate({ id, payload })}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No knowledge points match these filters. Upload a document and run extraction first.
        </div>
      )}
    </div>
  );
}

export default function KnowledgeReviewPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Loading review workspace…</div>}>
      <KnowledgeReviewContent />
    </Suspense>
  );
}
