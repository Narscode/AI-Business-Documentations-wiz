"use client";

import { AlertCircle, FileText, Target } from "lucide-react";
import type { KnowledgeGap } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SEVERITY_VARIANT: Record<
  string,
  "destructive" | "warning" | "secondary"
> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

export function GapPanel({ gaps }: { gaps: KnowledgeGap[] }) {
  if (gaps.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-6">
          <div className="rounded-md bg-success/10 p-2 text-success">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">No knowledge gaps identified</p>
            <p className="text-sm text-muted-foreground">
              You answered every knowledge point above the gap threshold. Strong work.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Knowledge gaps</CardTitle>
          <Badge variant="outline">
            {gaps.length} {gaps.length === 1 ? "area" : "areas"} to focus on
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Each gap traces back through the wrong answers to a specific knowledge point
          and the source document it came from.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {gaps.map((g) => (
          <div
            key={g.knowledge_point_id}
            className={cn(
              "rounded-lg border p-4",
              g.severity === "high"
                ? "border-destructive/30 bg-destructive/5"
                : g.severity === "medium"
                ? "border-warning/30 bg-warning/5"
                : "border-border bg-secondary/40"
            )}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertCircle
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    g.severity === "high"
                      ? "text-destructive"
                      : g.severity === "medium"
                      ? "text-warning"
                      : "text-muted-foreground"
                  )}
                />
                <div>
                  <p className="font-medium leading-snug">
                    {g.knowledge_point_title}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>{g.document_title}</span>
                  </div>
                </div>
              </div>
              <Badge variant={SEVERITY_VARIANT[g.severity]}>
                {g.severity} severity
              </Badge>
            </div>

            {g.summary && (
              <p className="mt-2 text-sm text-foreground/80">{g.summary}</p>
            )}

            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{g.questions_wrong}</strong> of{" "}
                <strong className="text-foreground">{g.questions_total}</strong> wrong
              </span>
              <span>
                Avg score: <strong className="text-foreground">{(g.avg_score * 100).toFixed(0)}%</strong>
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
