"use client";

import { useState } from "react";
import { Check, Sparkles, X, Brain } from "lucide-react";
import type { AnswerResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

function fmtAnswer(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(no answer)";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

interface AnswerReviewProps {
  answer: AnswerResult;
  onOverride?: (score: number, isCorrect: boolean, rationale: string) => Promise<void>;
}

export function AnswerReview({ answer, onOverride }: AnswerReviewProps) {
  const { currentUser } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [newScore, setNewScore] = useState(String(answer.score));
  const [isCorrect, setIsCorrect] = useState(answer.is_correct);
  const [rationale, setRationale] = useState(answer.ai_rationale || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullCredit = answer.score >= answer.max_score - 1e-6;
  const noCredit = answer.score === 0;
  const partial = !fullCredit && !noCredit;

  const isManager = currentUser?.role === "manager" || currentUser?.role === "admin";

  return (
    <Card className="border border-slate-200/80 shadow-sm relative overflow-hidden">
      {answer.is_correct ? (
        <div className="absolute left-0 top-0 h-full w-1 bg-success" />
      ) : (
        <div className="absolute left-0 top-0 h-full w-1 bg-destructive" />
      )}
      
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
              <Badge variant="outline" className="text-[9px] font-medium py-0.5">
                {answer.question_type} Check
              </Badge>
              <span>From: {answer.knowledge_point_title}</span>
            </div>
            <p className="text-sm font-semibold leading-snug text-slate-800">
              {answer.question_text}
            </p>
          </div>
          <div
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold shrink-0",
              answer.is_correct
                ? "bg-success/10 text-success"
                : partial
                ? "bg-warning/10 text-warning"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {answer.is_correct ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            {answer.score.toFixed(1)}/{answer.max_score.toFixed(0)} points
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-lg border bg-secondary/20 p-3.5">
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              Employee Response
            </p>
            <p className={cn("text-slate-700 leading-normal", noCredit && "text-rose-950 font-medium")}>
              {fmtAnswer(answer.employee_answer)}
            </p>
          </div>
          <div className="rounded-lg border border-success/20 bg-success/5 p-3.5 border-l-4 border-l-success">
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-600">
              {answer.question_type === "open" ? "Answer guidelines / Key points" : "Correct answer key"}
            </p>
            <p className="text-slate-800 leading-normal font-medium">{fmtAnswer(answer.correct_answer_json)}</p>
          </div>
        </div>

        {answer.ai_rationale && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/10 p-3.5 text-xs">
            <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" /> AI grader evaluation rationale
            </p>
            <p className="text-slate-700 leading-relaxed font-medium">{answer.ai_rationale}</p>
            {answer.ai_evidence && (
              <div className="mt-2.5 pt-2 border-t border-indigo-100/50 text-[11px] text-muted-foreground flex gap-1 leading-normal select-all">
                <span className="font-semibold text-slate-500">Source Evidence Trace:</span>
                <span className="italic font-serif">"{answer.ai_evidence}"</span>
              </div>
            )}
          </div>
        )}

        {answer.explanation && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-slate-550">Context Explanation:</span> {answer.explanation}
          </p>
        )}

        {/* Human-in-the-Loop Override Panel */}
        {isManager && onOverride && (
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-3">
            {!isEditing ? (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="text-[11px] h-8 border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 flex items-center gap-1"
                >
                  <Brain className="h-3.5 w-3.5 text-indigo-500" />
                  Audit AI Grade / Correct Score
                </Button>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-indigo-100 bg-indigo-50/5 space-y-4">
                <div className="flex items-center gap-1.5 border-b pb-2">
                  <Sparkles className="h-4 w-4 text-indigo-600 animate-pulse" />
                  <h5 className="font-bold text-xs text-indigo-950 uppercase tracking-wider">
                    Human-in-the-Loop Grading Audit
                  </h5>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Override Score (0.0 to {answer.max_score.toFixed(0)})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={answer.max_score}
                      step={0.1}
                      value={newScore}
                      onChange={(e) => setNewScore(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Evaluation Status Verdict
                    </label>
                    <select
                      value={isCorrect ? "true" : "false"}
                      onChange={(e) => setIsCorrect(e.target.value === "true")}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                    >
                      <option value="true">Correct / Verified</option>
                      <option value="false">Incorrect / Gap Identified</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Auditor Notes & Rationale
                  </label>
                  <textarea
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder="Provide details about why the score was adjusted, or custom grading explanation..."
                    rows={3}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                  />
                </div>

                {error && (
                  <p className="text-[10px] font-semibold text-rose-600">{error}</p>
                )}

                <div className="flex gap-2 justify-end pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setNewScore(String(answer.score));
                      setIsCorrect(answer.is_correct);
                      setRationale(answer.ai_rationale || "");
                      setError(null);
                    }}
                    className="text-xs h-8 text-slate-500 font-medium"
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        const parsed = parseFloat(newScore);
                        if (isNaN(parsed) || parsed < 0 || parsed > answer.max_score) {
                          throw new Error(`Score must be a number between 0 and ${answer.max_score}`);
                        }
                        await onOverride(parsed, isCorrect, rationale);
                        setIsEditing(false);
                      } catch (e: any) {
                        setError(e.message || "Failed to update override score.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-8 flex items-center gap-1"
                    disabled={busy}
                  >
                    Save Grade Override
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
