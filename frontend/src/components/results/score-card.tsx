"use client";

import { Trophy } from "lucide-react";
import type { AttemptResult } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ScoreCard({ result }: { result: AttemptResult }) {
  const pct = result.percent;
  const verdict =
    pct >= 85 ? "Strong" : pct >= 70 ? "Solid" : pct >= 50 ? "Developing" : "Needs work";
  const verdictColor =
    pct >= 85
      ? "text-success"
      : pct >= 70
      ? "text-primary"
      : pct >= 50
      ? "text-warning"
      : "text-destructive";

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-8">
        <div>
          <p className="text-sm text-muted-foreground">{result.assessment_title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-bold tracking-tight">{pct.toFixed(0)}%</span>
            <span className={cn("text-lg font-medium", verdictColor)}>{verdict}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.total_score.toFixed(1)} / {result.max_score.toFixed(0)} points
          </p>
        </div>
        <div
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-full",
            pct >= 70 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
          )}
        >
          <Trophy className="h-9 w-9" />
        </div>
      </CardContent>
    </Card>
  );
}
