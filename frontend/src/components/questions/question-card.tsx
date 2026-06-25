"use client";

import { Check, RefreshCw, X } from "lucide-react";
import type { Question } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const TYPE_LABEL: Record<string, string> = {
  mcq: "Multiple choice",
  multi: "Multi-select",
  tf: "True/False",
  open: "Open-ended",
};

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

function isCorrectOption(q: Question, opt: string): boolean {
  if (q.question_type === "mcq") {
    return String(q.correct_answer_json) === opt;
  }
  if (q.question_type === "multi") {
    const arr = Array.isArray(q.correct_answer_json) ? q.correct_answer_json : [];
    return arr.includes(opt);
  }
  return false;
}

export interface QuestionCardProps {
  question: Question;
  onApprove: () => void;
  onReject: () => void;
  onRegenerate: () => void;
  busy?: boolean;
  readOnly?: boolean;
}

export function QuestionCard({
  question: q,
  onApprove,
  onReject,
  onRegenerate,
  busy,
  readOnly,
}: QuestionCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{TYPE_LABEL[q.question_type]}</Badge>
              <Badge variant="outline">{q.difficulty}</Badge>
              <span>From: {q.knowledge_point_title}</span>
            </div>
            <p className="text-sm font-medium leading-snug">{q.question_text}</p>
          </div>
          <Badge variant={STATUS_VARIANT[q.status] ?? "secondary"}>
            {q.status}
          </Badge>
        </div>

        {q.question_type === "mcq" || q.question_type === "multi" ? (
          <ul className="mb-3 space-y-1.5 text-sm">
            {(q.options_json ?? []).map((opt, i) => {
              const correct = isCorrectOption(q, opt);
              return (
                <li
                  key={i}
                  className={
                    correct
                      ? "flex items-start gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2"
                      : "flex items-start gap-2 rounded-md border px-3 py-2"
                  }
                >
                  {correct && <Check className="mt-0.5 h-3.5 w-3.5 text-success" />}
                  <span className={correct ? "text-foreground" : "text-foreground/70"}>
                    {opt}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : q.question_type === "tf" ? (
          <p className="mb-3 text-sm">
            <span className="font-medium">Correct answer:</span>{" "}
            <span className="text-success">{String(q.correct_answer_json) === "true" ? "True" : "False"}</span>
          </p>
        ) : (
          <div className="mb-3 rounded-md border bg-secondary/40 p-3 text-sm">
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
              Model answer (for AI grading)
            </p>
            <p>{String(q.correct_answer_json ?? "")}</p>
          </div>
        )}

        {q.explanation && (
          <p className="mb-3 text-xs text-muted-foreground">
            <span className="font-medium">Why:</span> {q.explanation}
          </p>
        )}

        {!readOnly && (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onRegenerate}
              disabled={busy}
            >
              <RefreshCw className="h-3 w-3" />
              Regenerate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onReject}
              disabled={busy}
            >
              <X className="h-3 w-3" />
              Reject
            </Button>
            <Button
              size="sm"
              variant={q.status === "approved" ? "secondary" : "success"}
              onClick={onApprove}
              disabled={busy}
            >
              <Check className="h-3 w-3" />
              {q.status === "approved" ? "Approved" : "Approve"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
