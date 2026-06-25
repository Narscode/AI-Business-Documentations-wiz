"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { api, ApiError, uploadFile } from "@/lib/api";
import type { DocumentSummary } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  uploaded: "secondary",
  extracting: "warning",
  extracted: "success",
  failed: "destructive",
};

export default function DocumentsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => api<DocumentSummary[]>("/api/documents"),
  });

  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadFile<DocumentSummary>("/api/documents", file),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: ApiError) => setError(e.message),
  });

  const extract = useMutation({
    mutationFn: (id: number) =>
      api(`/api/documents/${id}/extract`, { method: "POST" }),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: ApiError) => setError(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="mt-1 text-muted-foreground">
            Upload internal docs. The AI extracts atomic knowledge points grounded in source excerpts.
          </p>
        </div>
        <Button
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload document
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : docs && docs.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {docs.map((d) => (
            <Card key={d.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{d.title}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {d.original_filename}
                    </p>
                  </div>
                </div>
                <Badge variant={STATUS_VARIANT[d.status] ?? "secondary"}>
                  {d.status}
                </Badge>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {d.kp_count > 0 ? (
                    <>
                      {d.kp_approved}/{d.kp_count} KPs approved
                    </>
                  ) : (
                    "No KPs yet"
                  )}
                </div>
                <div className="flex gap-2">
                  <Link href={`/knowledge?document_id=${d.id}`}>
                    <Button variant="ghost" size="sm">
                      View KPs
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant={d.kp_count > 0 ? "outline" : "default"}
                    onClick={() => extract.mutate(d.id)}
                    disabled={
                      extract.isPending && extract.variables === d.id
                    }
                  >
                    {extract.isPending && extract.variables === d.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {d.kp_count > 0 ? "Re-extract" : "Extract"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No documents uploaded yet</p>
            <Button onClick={() => fileRef.current?.click()}>
              Upload your first document
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
