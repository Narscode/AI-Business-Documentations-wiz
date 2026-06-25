"use client";

import { BookMarked, Lightbulb, Sparkles, Target } from "lucide-react";
import type { LearningRecommendation } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RecommendationsPanel({
  recommendation,
}: {
  recommendation: LearningRecommendation | null;
}) {
  if (!recommendation) return null;

  const hasContent =
    recommendation.weak_topics.length > 0 ||
    recommendation.next_steps.length > 0 ||
    recommendation.suggested_resources.length > 0;
  if (!hasContent) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Your personalized learning plan
          </CardTitle>
          <Badge variant="default">AI generated</Badge>
        </div>
        {recommendation.encouragement && (
          <p className="text-sm text-foreground/80">{recommendation.encouragement}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {recommendation.weak_topics.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
              <Target className="h-3 w-3" /> Focus areas
            </h3>
            <div className="flex flex-wrap gap-2">
              {recommendation.weak_topics.map((t, i) => (
                <Badge key={i} variant="warning">
                  {t}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {recommendation.next_steps.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
              <Lightbulb className="h-3 w-3" /> This week, do this
            </h3>
            <ol className="space-y-2 text-sm">
              {recommendation.next_steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {i + 1}
                  </span>
                  <span className="text-foreground/85">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {recommendation.suggested_resources.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
              <BookMarked className="h-3 w-3" /> Re-read
            </h3>
            <ul className="space-y-2 text-sm">
              {recommendation.suggested_resources.map((r, i) => (
                <li
                  key={i}
                  className="rounded-md border border-primary/20 bg-primary/5 p-3"
                >
                  <p className="font-medium text-foreground/90">
                    {r.document_title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.focus_area}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
