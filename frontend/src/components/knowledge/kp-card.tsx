"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { KnowledgePoint } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  pending: "warning",
  approved: "success",
  edited: "success",
  rejected: "destructive",
};

export interface KpCardProps {
  kp: KnowledgePoint;
  onUpdate: (
    id: number,
    payload: Partial<{
      title: string;
      description: string;
      source_excerpt: string;
      status: KnowledgePoint["status"];
    }>
  ) => void;
  busy?: boolean;
}

export function KpCard({ kp, onUpdate, busy }: KpCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(kp.title);
  const [description, setDescription] = useState(kp.description);

  const saveEdits = () => {
    onUpdate(kp.id, { title, description, status: "edited" });
    setEditing(false);
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-medium"
            />
          ) : (
            <h3 className="font-medium leading-snug">{kp.title}</h3>
          )}
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={STATUS_VARIANT[kp.status] ?? "secondary"}>
              {kp.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {(kp.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {editing ? (
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mb-3"
          />
        ) : (
          <p className="mb-3 text-sm text-foreground/80">{kp.description}</p>
        )}

        {kp.source_excerpt && (
          <div className="mb-3 rounded-md border-l-2 border-primary/40 bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/70">Source:</span>{" "}
            &ldquo;{kp.source_excerpt}&rdquo;
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{kp.document_title}</p>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setTitle(kp.title);
                    setDescription(kp.description);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={saveEdits} disabled={busy}>
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(true)}
                  disabled={busy}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdate(kp.id, { status: "rejected" })}
                  disabled={busy}
                >
                  <X className="h-3 w-3" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant={
                    kp.status === "approved" || kp.status === "edited"
                      ? "secondary"
                      : "success"
                  }
                  onClick={() => onUpdate(kp.id, { status: "approved" })}
                  disabled={busy}
                >
                  <Check className="h-3 w-3" />
                  {kp.status === "approved" || kp.status === "edited"
                    ? "Approved"
                    : "Approve"}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
