"use client";

import { Check, ChevronDown, ChevronRight, Target } from "lucide-react";
import { useState } from "react";
import type { CoverageReport } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CoveragePanel({ report }: { report: CoverageReport }) {
  const [showUncovered, setShowUncovered] = useState(true);
  const [showCovered, setShowCovered] = useState(false);

  if (report.total_kps === 0) {
    return null;
  }

  const pct = report.coverage_pct;
  const pctColor =
    pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Knowledge coverage
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Approved knowledge points from the source documents, and whether
              this assessment tests them.
            </p>
          </div>
          <div className="text-right">
            <p className={cn("text-3xl font-bold tracking-tight", pctColor)}>
              {pct.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {report.covered_kps} of {report.total_kps} KPs covered
            </p>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full transition-all",
              pct >= 80
                ? "bg-success"
                : pct >= 50
                ? "bg-warning"
                : "bg-destructive"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {report.uncovered.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowUncovered((v) => !v)}
              className="flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-accent"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {showUncovered ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Not tested ({report.uncovered.length})
              </span>
              <Badge variant="warning">Gap in coverage</Badge>
            </button>
            {showUncovered && (
              <ul className="mt-2 space-y-1">
                {report.uncovered.map((item) => (
                  <li
                    key={item.knowledge_point_id}
                    className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm"
                  >
                    {item.knowledge_point_title}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {report.covered.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowCovered((v) => !v)}
              className="flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-accent"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {showCovered ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Covered ({report.covered.length})
              </span>
              <Badge variant="success">
                <Check className="mr-1 h-3 w-3" /> Tested
              </Badge>
            </button>
            {showCovered && (
              <ul className="mt-2 space-y-1">
                {report.covered.map((item) => (
                  <li
                    key={item.knowledge_point_id}
                    className="flex items-center justify-between rounded-md border bg-secondary/40 px-3 py-2 text-sm"
                  >
                    <span>{item.knowledge_point_title}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.question_count}{" "}
                      {item.question_count === 1 ? "question" : "questions"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
