"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AttemptRead, AttemptResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionInput } from "@/components/exam/question-input";

export default function ExamPage() {
  const params = useParams<{ id: string }>();
  const attemptId = Number(params.id);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  const [index, setIndex] = useState(0);
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: () => api<AttemptRead>(`/api/attempts/${attemptId}`),
    enabled: Number.isFinite(attemptId),
  });

  // Seed local state once on load
  useEffect(() => {
    if (data && Object.keys(answers).length === 0 && Object.keys(data.saved_answers ?? {}).length > 0) {
      setAnswers(data.saved_answers as Record<number, unknown>);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const saveAnswer = useMutation({
    mutationFn: ({ qid, answer }: { qid: number; answer: unknown }) =>
      api(`/api/attempts/${attemptId}/answer`, {
        method: "POST",
        body: { question_id: qid, answer_json: answer },
      }),
  });

  const submit = useMutation({
    mutationFn: () =>
      api<AttemptResult>(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
      }),
    onSuccess: () => router.push(`/results/${attemptId}`),
    onError: (e: ApiError) => setError(e.message),
  });

  const questions = data?.questions ?? [];
  const total = questions.length;
  const currentQ = questions[index];
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== "" && !(Array.isArray(answers[q.id]) && (answers[q.id] as []).length === 0)).length,
    [questions, answers]
  );

  const handleAnswerChange = (qid: number, value: unknown) => {
    setAnswers((cur) => ({ ...cur, [qid]: value }));
    // Debounced autosave 800ms
    if (saveTimers.current[qid]) clearTimeout(saveTimers.current[qid]);
    saveTimers.current[qid] = setTimeout(() => {
      saveAnswer.mutate({ qid, answer: value });
    }, 800);
  };

  if (isLoading || !data) {
    return <div className="text-muted-foreground">Loading…</div>;
  }
  if (total === 0) {
    return (
      <div className="text-muted-foreground">
        This exam has no approved questions yet.
      </div>
    );
  }
  if (data.status === "submitted") {
    router.push(`/results/${attemptId}`);
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{data.assessment_title}</h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            Question {index + 1} of {total}
          </span>
          <Badge variant="outline">
            {answeredCount}/{total} answered
          </Badge>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {currentQ && (
        <Card>
          <CardContent className="space-y-5 p-6">
            <div>
              <Badge variant="outline" className="mb-3">
                {currentQ.question_type === "mcq"
                  ? "Multiple choice"
                  : currentQ.question_type === "multi"
                  ? "Multi-select"
                  : currentQ.question_type === "tf"
                  ? "True/False"
                  : "Open-ended"}
              </Badge>
              <p className="text-base font-medium leading-snug">
                {currentQ.question_text}
              </p>
            </div>
            <QuestionInput
              question={currentQ}
              value={answers[currentQ.id]}
              onChange={(v) => handleAnswerChange(currentQ.id, v)}
            />
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        {index < total - 1 ? (
          <Button onClick={() => setIndex((i) => i + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="success"
            onClick={() => {
              // flush any pending autosaves
              Object.values(saveTimers.current).forEach((t) => clearTimeout(t));
              const pending = Object.entries(answers).map(([qid, ans]) =>
                saveAnswer.mutateAsync({ qid: Number(qid), answer: ans })
              );
              Promise.all(pending).finally(() => submit.mutate());
            }}
            disabled={submit.isPending}
          >
            {submit.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Scoring…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Submit
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
