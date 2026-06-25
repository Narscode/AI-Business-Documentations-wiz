"use client";

import { useQuery } from "@tanstack/react-query";
import { ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import type { Assessment } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "success" | "warning"
> = {
  draft: "warning",
  published: "success",
  closed: "secondary",
};

export default function AssessmentsPage() {
  const { currentUser } = useUser();
  const { data, isLoading } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => api<Assessment[]>("/api/assessments"),
  });

  const canCreate =
    currentUser?.role === "manager" || currentUser?.role === "admin";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Assessments</h1>
          <p className="mt-1 text-muted-foreground">
            Goal-driven assessments generated from approved knowledge points.
          </p>
        </div>
        {canCreate && (
          <Link href="/assessments/new">
            <Button>
              <Plus className="h-4 w-4" /> New assessment
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.map((a) => (
            <Link key={a.id} href={`/assessments/${a.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                      <ListChecks className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{a.title}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Target: {a.target_role} · {a.difficulty}
                      </p>
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"}>
                    {a.status}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-sm text-foreground/80">{a.goal}</p>
                  <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                    <span>{a.question_total} questions ({a.question_approved} approved)</span>
                    <span>·</span>
                    <span>{a.attempt_count} attempts</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <ListChecks className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No assessments yet</p>
            {canCreate && (
              <Link href="/assessments/new">
                <Button>Create your first assessment</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
