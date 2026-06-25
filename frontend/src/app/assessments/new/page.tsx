"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Assessment, DocumentSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function NewAssessmentPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [targetRole, setTargetRole] = useState("Support agent");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState(6);
  const [docIds, setDocIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  // New multi-mode state variables
  const [examMode, setExamMode] = useState<"practice" | "assessment">("practice");
  const [deadlineAt, setDeadlineAt] = useState("");
  const [attemptLimit, setAttemptLimit] = useState(1);
  const [showAnswers, setShowAnswers] = useState(true);
  const [showExplanations, setShowExplanations] = useState(true);

  const { data: docs } = useQuery({
    queryKey: ["documents"],
    queryFn: () => api<DocumentSummary[]>("/api/documents"),
  });

  const create = useMutation({
    mutationFn: async () => {
      const created = await api<Assessment>("/api/assessments", {
        method: "POST",
        body: {
          title,
          goal,
          target_role: targetRole,
          difficulty,
          question_count: count,
          document_ids: docIds,
          exam_mode: examMode,
          deadline_at: examMode === "assessment" && deadlineAt ? new Date(deadlineAt).toISOString() : null,
          attempt_limit: examMode === "assessment" ? attemptLimit : null,
          show_answers: examMode === "assessment" ? showAnswers : true,
          show_explanations: examMode === "assessment" ? showExplanations : true,
        },
      });
      // Immediately trigger question generation
      await api<Assessment>(`/api/assessments/${created.id}/generate`, {
        method: "POST",
      });
      return created;
    },
    onSuccess: (a) => router.push(`/assessments/${a.id}`),
    onError: (e: ApiError) => setError(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">New assessment</h1>
        <p className="mt-1 text-muted-foreground">
          Describe the exam goal — the AI generates questions from approved knowledge points only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assessment details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Onboarding readiness — Q2"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal">Exam goal</Label>
            <Textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Verify support agents understand the Wizlynn escalation tiers, refund windows, and customer-PIN verification flow."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              The goal influences which KPs get tested and how questions are framed.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Target role</Label>
              <Input
                id="role"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as never)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="count">Question count</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={30}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 1)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="examMode">Exam Mode</Label>
              <Select
                id="examMode"
                value={examMode}
                onChange={(e) => {
                  const mode = e.target.value as "practice" | "assessment";
                  setExamMode(mode);
                  if (mode === "practice") {
                    setShowAnswers(true);
                    setShowExplanations(true);
                  } else {
                    setShowAnswers(false);
                    setShowExplanations(false);
                  }
                }}
              >
                <option value="practice">Practice Mode</option>
                <option value="assessment">Assessment Mode</option>
              </Select>
            </div>
            {examMode === "assessment" && (
              <div className="space-y-2">
                <Label htmlFor="attemptLimit">Attempt Limit</Label>
                <Input
                  id="attemptLimit"
                  type="number"
                  min={1}
                  value={attemptLimit}
                  onChange={(e) => setAttemptLimit(Number(e.target.value) || 1)}
                />
              </div>
            )}
          </div>

          {examMode === "assessment" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deadlineAt">Deadline</Label>
                <Input
                  id="deadlineAt"
                  type="datetime-local"
                  value={deadlineAt}
                  onChange={(e) => setDeadlineAt(e.target.value)}
                />
              </div>
              <div className="flex flex-col justify-end gap-2 text-sm pt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showAnswers}
                    onChange={(e) => setShowAnswers(e.target.checked)}
                  />
                  <span>Show answers on submission</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showExplanations}
                    onChange={(e) => setShowExplanations(e.target.checked)}
                  />
                  <span>Show explanations on submission</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-primary/10 p-3 text-xs text-primary">
              Practice mode configuration: Unlimited attempts, immediate feedback, and AI gap analyses enabled.
            </div>
          )}

          <div className="space-y-2">
            <Label>Source documents</Label>
            <div className="flex flex-col gap-2 rounded-md border p-3">
              {(docs ?? []).map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={docIds.includes(d.id)}
                    onChange={(e) => {
                      setDocIds((cur) =>
                        e.target.checked
                          ? [...cur, d.id]
                          : cur.filter((id) => id !== d.id)
                      );
                    }}
                  />
                  <span className="flex-1">{d.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.kp_approved}/{d.kp_count} KPs approved
                  </span>
                </label>
              ))}
              {(!docs || docs.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No documents available — upload one first.
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            onClick={() => create.mutate()}
            disabled={
              create.isPending ||
              !title ||
              !goal ||
              docIds.length === 0
            }
            className="w-full"
          >
            {create.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating questions…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Create + generate questions
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
