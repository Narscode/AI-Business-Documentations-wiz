"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { GraduationCap, ListChecks, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import type { Assessment } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ExamListPage() {
  const router = useRouter();
  const { currentUser } = useUser();
  const isManager =
    currentUser?.role === "manager" || currentUser?.role === "admin";
  const { data, isLoading } = useQuery({
    queryKey: ["assessments-published"],
    queryFn: async () => {
      const all = await api<Assessment[]>("/api/assessments");
      return all.filter((a) => a.status === "published");
    },
  });

  const start = useMutation({
    mutationFn: (assessment_id: number) =>
      api<{ id: number }>("/api/attempts", {
        method: "POST",
        body: { assessment_id },
      }),
    onSuccess: (att) => router.push(`/exam/${att.id}`),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Available exams</h1>
        <p className="mt-1 text-muted-foreground">
          {isManager
            ? "Preview any published assessment, or jump to Assessments to manage them."
            : "Take any published assessment to verify your knowledge."}
        </p>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {data.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{a.goal}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{a.difficulty}</Badge>
                  <Badge variant="outline">{a.question_approved} q</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex justify-end">
                {isManager ? (
                  <Link href={`/assessments/${a.id}`}>
                    <Button variant="outline" className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4" />
                      Manage
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={() => start.mutate(a.id)}
                    disabled={start.isPending}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {isManager
                ? "No published exams yet. Create an assessment, approve its questions, and publish it."
                : "No published exams yet. Ask your manager to publish one."}
            </p>
            {isManager && (
              <Link href="/assessments">
                <Button variant="outline">
                  <ListChecks className="h-4 w-4" /> Go to Assessments
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
