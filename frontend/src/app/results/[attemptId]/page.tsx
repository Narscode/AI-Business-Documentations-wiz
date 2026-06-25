"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AttemptResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { AnswerReview } from "@/components/results/answer-review";
import { GapPanel } from "@/components/results/gap-panel";
import { RecommendationsPanel } from "@/components/results/recommendations-panel";
import { ScoreCard } from "@/components/results/score-card";

export default function ResultsPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = Number(params.attemptId);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["attempt-results", attemptId],
    queryFn: () => api<AttemptResult>(`/api/attempts/${attemptId}/results`),
    enabled: Number.isFinite(attemptId),
  });

  const generatePractice = useMutation({
    mutationFn: async () => {
      setError(null);
      const res = await api<{ assessment_id: number }>(`/api/attempts/${attemptId}/generate-practice`, {
        method: "POST",
      });
      const att = await api<{ id: number }>("/api/attempts", {
        method: "POST",
        body: { assessment_id: res.assessment_id },
      });
      return att;
    },
    onSuccess: (att) => {
      router.push(`/exam/${att.id}`);
    },
    onError: (e: ApiError) => {
      setError(e.message || "Failed to generate adaptive practice set.");
    },
  });

  const queryClient = useQueryClient();
  const overrideGrade = useMutation({
    mutationFn: async ({
      questionId,
      score,
      isCorrect,
      aiRationale,
    }: {
      questionId: number;
      score: number;
      isCorrect: boolean;
      aiRationale: string;
    }) => {
      return api(`/api/attempts/${attemptId}/answers/${questionId}/override`, {
        method: "PATCH",
        body: { score, is_correct: isCorrect, ai_rationale: aiRationale },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attempt-results", attemptId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-employee"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-manager"] });
    },
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/exam"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to exams
          </Link>
          <h1 className="mt-3 text-2xl font-semibold">Results</h1>
        </div>
      </div>

      <div className="space-y-6">
        <ScoreCard result={data} />
        <GapPanel gaps={data.gaps} />
        <RecommendationsPanel recommendation={data.recommendation} />

        <div>
          <h2 className="mb-3 text-lg font-semibold">Per-question feedback</h2>
          <div className="space-y-3">
            {data.answers.map((a) => (
              <AnswerReview 
                key={a.question_id} 
                answer={a} 
                onOverride={async (score, isCorrect, rationale) => {
                  await overrideGrade.mutateAsync({
                    questionId: a.question_id,
                    score,
                    isCorrect,
                    aiRationale: rationale
                  });
                }}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/exam">
            <Button variant="outline">Take another exam</Button>
          </Link>
          {data.exam_mode === "practice" && (
            <Button
              onClick={() => generatePractice.mutate()}
              disabled={generatePractice.isPending}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium shadow-md shadow-violet-500/10 flex items-center gap-2"
            >
              {generatePractice.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating practice…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate adaptive practice
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
