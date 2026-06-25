"use client";

import type { AttemptQuestionView } from "@/lib/types";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface QuestionInputProps {
  question: AttemptQuestionView;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function QuestionInput({ question, value, onChange }: QuestionInputProps) {
  if (question.question_type === "mcq") {
    return (
      <div className="space-y-2">
        {(question.options_json ?? []).map((opt, i) => {
          const selected = value === opt;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "block w-full rounded-md border px-4 py-3 text-left text-sm transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "hover:bg-accent"
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.question_type === "multi") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Select all that apply.</p>
        {(question.options_json ?? []).map((opt, i) => {
          const selected = arr.includes(opt);
          return (
            <button
              key={i}
              type="button"
              onClick={() =>
                onChange(
                  selected ? arr.filter((x) => x !== opt) : [...arr, opt]
                )
              }
              className={cn(
                "flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "hover:bg-accent"
              )}
            >
              <div
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  selected ? "border-primary bg-primary" : "border-input"
                )}
              >
                {selected && (
                  <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6.5L5 9l4.5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.question_type === "tf") {
    return (
      <div className="flex gap-3">
        {[
          { label: "True", val: true },
          { label: "False", val: false },
        ].map(({ label, val }) => {
          const selected = value === val;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onChange(val)}
              className={cn(
                "flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors",
                selected
                  ? "border-primary bg-primary/5 text-primary"
                  : "hover:bg-accent"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  // open
  return (
    <Textarea
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type your answer here…"
      rows={5}
    />
  );
}
