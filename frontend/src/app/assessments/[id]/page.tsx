"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Sparkles, Brain } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import type { AssessmentDetail, CoverageReport, Question, ManagerCompletion } from "@/lib/types";
import { CoveragePanel } from "@/components/assessments/coverage-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestionCard } from "@/components/questions/question-card";
import { useState } from "react";

export default function AssessmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const router = useRouter();
  const { currentUser } = useUser();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["assessment", id],
    queryFn: () => api<AssessmentDetail>(`/api/assessments/${id}`),
    enabled: Number.isFinite(id),
  });

  const { data: coverage } = useQuery({
    queryKey: ["assessment-coverage", id],
    queryFn: () => api<CoverageReport>(`/api/assessments/${id}/coverage`),
    enabled: Number.isFinite(id) && !!data && data.questions.length > 0,
  });

  const { data: completions, isLoading: completionsLoading } = useQuery({
    queryKey: ["assessment-attempts", id],
    queryFn: () => api<ManagerCompletion[]>(`/api/assessments/${id}/attempts`),
    enabled: Number.isFinite(id) && (currentUser?.role === "manager" || currentUser?.role === "admin"),
  });

  const updateQuestion = useMutation({
    mutationFn: ({ qid, payload }: { qid: number; payload: Record<string, unknown> }) =>
      api<Question>(`/api/questions/${qid}`, { method: "PATCH", body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessment", id] });
      qc.invalidateQueries({ queryKey: ["assessments"] });
      qc.invalidateQueries({ queryKey: ["assessment-coverage", id] });
    },
  });

  const regenerate = useMutation({
    mutationFn: (qid: number) =>
      api<Question>(`/api/questions/${qid}/regenerate`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessment", id] });
      qc.invalidateQueries({ queryKey: ["assessment-coverage", id] });
    },
  });

  const generate = useMutation({
    mutationFn: () =>
      api<AssessmentDetail>(`/api/assessments/${id}/generate`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessment", id] });
      qc.invalidateQueries({ queryKey: ["assessment-coverage", id] });
    },
    onError: (e: ApiError) => setError(e.message),
  });

  const publish = useMutation({
    mutationFn: () =>
      api(`/api/assessments/${id}/publish`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessment", id] });
      qc.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (e: ApiError) => setError(e.message),
  });

  const startAttempt = useMutation({
    mutationFn: () =>
      api<{ id: number }>("/api/attempts", {
        method: "POST",
        body: { assessment_id: id },
      }),
    onSuccess: (att) => router.push(`/exam/${att.id}`),
    onError: (e: ApiError) => setError(e.message),
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading…</div>;

  const isAdmin = currentUser?.role === "admin";
  const isManager = currentUser?.role === "manager" || isAdmin;
  const canTake = data.status === "published";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <Link
          href="/assessments"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to assessments
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">{data.title}</h1>
            <p className="mt-1 text-muted-foreground">{data.goal}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Target: {data.target_role}</Badge>
              <Badge variant="outline">{data.difficulty}</Badge>
              <Badge variant="outline">{data.questions.length} questions</Badge>
              <Badge
                variant={
                  data.status === "published" ? "success" : "warning"
                }
              >
                {data.status}
              </Badge>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {isManager && data.status === "draft" && data.questions.length === 0 && (
              <Button
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
              >
                {generate.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate questions
              </Button>
            )}
            {isManager && data.status === "draft" && data.question_approved > 0 && (
              <Button
                variant="success"
                onClick={() => publish.mutate()}
                disabled={publish.isPending}
              >
                <Send className="h-4 w-4" />
                Publish
              </Button>
            )}
            {canTake && (
              <Button
                onClick={() => startAttempt.mutate()}
                disabled={startAttempt.isPending}
              >
                Start exam
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {data.questions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              No questions yet. {isManager && "Click Generate to create them from approved KPs."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {coverage && <CoveragePanel report={coverage} />}

          {/* Employee Completed Attempts & AI Review Panel */}
          {isManager && (
            <Card className="border border-indigo-100 shadow-sm">
              <CardHeader className="bg-indigo-50/20 p-5 border-b">
                <CardTitle className="text-base flex items-center gap-2 text-indigo-955">
                  <Brain className="h-4.5 w-4.5 text-indigo-600" />
                  Employee Completions & AI Feedback Reviews
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Track employee scores, view completed questions, and read AI rationales and evidence.
                </p>
              </CardHeader>
              <CardContent className="p-5">
                {completionsLoading ? (
                  <div className="text-xs text-muted-foreground animate-pulse">Loading employee attempts...</div>
                ) : completions && completions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground pb-2">
                          <th className="py-2.5 px-2">Employee</th>
                          <th className="py-2.5 px-2 text-right">Score</th>
                          <th className="py-2.5 px-2 text-center">Status</th>
                          <th className="py-2.5 px-2">Date Submitted</th>
                          <th className="py-2.5 px-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {completions.map((comp) => {
                          const isPassed = comp.percent >= 70;
                          return (
                            <tr key={comp.attempt_id} className="hover:bg-accent/30 transition-colors">
                              <td className="py-3 px-2 font-semibold text-slate-800">{comp.employee_name}</td>
                              <td className="py-3 px-2 text-right font-bold text-slate-900">{comp.percent}%</td>
                              <td className="py-3 px-2 text-center">
                                <Badge variant={isPassed ? "success" : "destructive"} className="text-[10px] px-1.5 py-0.5">
                                  {isPassed ? "Verified" : "Failed"}
                                </Badge>
                              </td>
                              <td className="py-3 px-2 text-muted-foreground">
                                {comp.submitted_at ? new Date(comp.submitted_at).toLocaleString() : "—"}
                              </td>
                              <td className="py-3 px-2 text-right">
                                <Link href={`/results/${comp.attempt_id}`}>
                                  <Button size="sm" variant="outline" className="text-[11px] h-7 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    Review AI Feedbacks
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    No completions recorded for this assessment yet.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Questions ({data.question_approved} of {data.questions.length} approved)
              </CardTitle>
            </CardHeader>
          </Card>
          {data.questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              readOnly={!isAdmin}
              busy={
                (updateQuestion.isPending && updateQuestion.variables?.qid === q.id) ||
                (regenerate.isPending && regenerate.variables === q.id)
              }
              onApprove={() =>
                updateQuestion.mutate({ qid: q.id, payload: { status: "approved" } })
              }
              onReject={() =>
                updateQuestion.mutate({ qid: q.id, payload: { status: "rejected" } })
              }
              onRegenerate={() => regenerate.mutate(q.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
