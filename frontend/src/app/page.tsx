"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  FileText,
  GraduationCap,
  ListChecks,
  Users,
  Award,
  AlertTriangle,
  Flame,
  CheckCircle,
  XCircle,
  HelpCircle,
  Plus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import type { 
  DashboardStats, 
  EmployeeDashboardData, 
  ManagerDashboardData 
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function StatCard({
  label,
  value,
  hint,
  Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-6">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { currentUser } = useUser();

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api<DashboardStats>("/api/dashboard/stats"),
    enabled: !!currentUser,
  });

  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ["dashboard-employee"],
    queryFn: () => api<EmployeeDashboardData>("/api/dashboard/employee"),
    enabled: currentUser?.role === "employee",
  });

  const { data: mgrData, isLoading: mgrLoading } = useQuery({
    queryKey: ["dashboard-manager"],
    queryFn: () => api<ManagerDashboardData>("/api/dashboard/manager"),
    enabled: currentUser?.role === "manager" || currentUser?.role === "admin",
  });

  if (!currentUser) return null;

  const isEmployee = currentUser.role === "employee";
  const isManager = currentUser.role === "manager" || currentUser.role === "admin";

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Welcome Banner */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {currentUser.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {currentUser.role === "admin" &&
            "Upload documents, review extracted knowledge, and approve generated questions."}
          {currentUser.role === "manager" &&
            "Create assessments, track results, and identify knowledge gaps across your team."}
          {currentUser.role === "employee" &&
            "Take practice assessments, verify your capabilities, and see custom study recommendations."}
        </p>
      </div>

      {/* Stats row for Admins/Managers */}
      {isManager && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Documents uploaded"
            value={statsLoading ? "—" : statsData?.documents_uploaded ?? 0}
            Icon={FileText}
          />
          <StatCard
            label="Knowledge points"
            value={statsLoading ? "—" : statsData?.knowledge_points_extracted ?? 0}
            hint={statsData ? `${statsData.knowledge_points_approved} approved` : undefined}
            Icon={Brain}
          />
          <StatCard
            label="Assessments"
            value={statsLoading ? "—" : statsData?.assessments_created ?? 0}
            hint={statsData ? `${statsData.assessments_published} published` : undefined}
            Icon={ListChecks}
          />
          <StatCard
            label="Employees assessed"
            value={statsLoading ? "—" : statsData?.employees_assessed ?? 0}
            Icon={Users}
          />
        </div>
      )}

      {/* ---------------- EMPLOYEE DASHBOARD VIEWS ---------------- */}
      {isEmployee && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Main Assessment & Practice lists */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Assessment Section (Formal Evaluation) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Assessment Section (Official Evaluations)
                </CardTitle>
                <CardDescription>
                  Formal assessments logged for official team capability records.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {empLoading ? (
                  <div className="text-sm text-muted-foreground">Loading assessments…</div>
                ) : empData?.official_attempts && empData.official_attempts.length > 0 ? (
                  <div className="divide-y rounded-md border">
                    {empData.official_attempts.map((att) => (
                      <div key={att.attempt_id} className="flex items-center justify-between p-4 text-sm">
                        <div>
                          <p className="font-medium">{att.assessment_title}</p>
                          <p className="text-xs text-muted-foreground">
                            Submitted on {att.submitted_at ? new Date(att.submitted_at).toLocaleDateString() : "Draft"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-base">{att.percent}%</span>
                          <Badge variant={att.percent >= 70 ? "success" : "destructive"}>
                            {att.percent >= 70 ? "Verified" : "Not Verified"}
                          </Badge>
                          <Link href={`/results/${att.attempt_id}`}>
                            <span className="text-xs text-primary hover:underline cursor-pointer">View Results</span>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    No official assessments completed yet. Click Browse Exams to take one.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Practice Section (Unlimited Self-Testing) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-amber-500" />
                  Practice Section (Self-Study)
                </CardTitle>
                <CardDescription>
                  Take practice attempts with immediate feedback and explanations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {empLoading ? (
                  <div className="text-sm text-muted-foreground">Loading practice...</div>
                ) : empData?.practice_attempts && empData.practice_attempts.length > 0 ? (
                  <div className="divide-y rounded-md border">
                    {empData.practice_attempts.map((att) => (
                      <div key={att.attempt_id} className="flex items-center justify-between p-4 text-sm">
                        <div>
                          <p className="font-medium">{att.assessment_title}</p>
                          <p className="text-xs text-muted-foreground">
                            Completed {att.submitted_at ? new Date(att.submitted_at).toLocaleDateString() : "In progress"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{att.percent}%</span>
                          <Link href={`/results/${att.attempt_id}`}>
                            <span className="text-xs text-primary hover:underline cursor-pointer">Review Gaps</span>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    No practice runs recorded.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar for Gaps & Readiness Predictions */}
          <div className="space-y-6">
            {/* AI Readiness Predictor */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-indigo-500" />
                  AI Readiness Predictor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {empLoading ? (
                  <div className="text-sm text-muted-foreground">Calculating readiness…</div>
                ) : empData?.readiness_predictions && empData.readiness_predictions.length > 0 ? (
                  <div className="space-y-3">
                    {empData.readiness_predictions.map((pred) => (
                      <div key={pred.assessment_id} className="rounded-md border p-3 text-xs space-y-2 bg-accent/40">
                        <div className="flex items-center justify-between font-medium">
                          <span className="truncate max-w-[150px]">{pred.assessment_title}</span>
                          <Badge
                            variant={
                              pred.readiness === "Ready"
                                ? "success"
                                : pred.readiness === "Moderately Ready"
                                ? "warning"
                                : "destructive"
                            }
                          >
                            {pred.readiness}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">{pred.rationale}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No predictions available yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Weak Topics / Areas of Improvement */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Weakest Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {empLoading ? (
                  <div className="text-sm text-muted-foreground">Loading weaknesses...</div>
                ) : empData?.weak_topics && empData.weak_topics.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {empData.weak_topics.map((topic) => (
                      <Badge key={topic.knowledge_point_id} variant="secondary" className="flex items-center gap-1.5 py-1">
                        <span>{topic.title}</span>
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                          {topic.count}
                        </span>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Excellent! No recurring knowledge gaps identified.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ---------------- MANAGER DASHBOARD VIEWS ---------------- */}
      {isManager && (
        <div className="space-y-6">
          {/* Create Exam Call to Action Banner */}
          <Card className="bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-blue-600/10 border-violet-500/20">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Plus className="h-5 w-5 text-violet-500" />
                  Build a Knowledge Verification Exam
                </h3>
                <p className="text-sm text-muted-foreground">
                  Create practice sets or official assessments from approved knowledge points to verify your team's capabilities.
                </p>
              </div>
              <Link href="/assessments/new" className="shrink-0">
                <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium shadow-md shadow-violet-500/10 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Build assessment
                </Button>
              </Link>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Assessment Completions (Verification View) */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Capability Verification View</CardTitle>
              <CardDescription>
                Live tracker of employee assessment completions and scoring modes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mgrLoading ? (
                <div className="text-sm text-muted-foreground">Loading completions…</div>
              ) : mgrData?.completions && mgrData.completions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th className="py-3 px-2">Employee</th>
                        <th className="py-3 px-2">Assessment</th>
                        <th className="py-3 px-2">Mode</th>
                        <th className="py-3 px-2 text-right">Score</th>
                        <th className="py-3 px-2 text-center">Status</th>
                        <th className="py-3 px-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {mgrData.completions.map((comp) => (
                        <tr key={comp.attempt_id} className="hover:bg-accent/40">
                          <td className="py-3 px-2 font-medium">{comp.employee_name}</td>
                          <td className="py-3 px-2 max-w-[200px] truncate">{comp.assessment_title}</td>
                          <td className="py-3 px-2">
                            <Badge variant="outline" className="capitalize">
                              {comp.exam_mode}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-right font-semibold">{comp.percent}%</td>
                          <td className="py-3 px-2 text-center">
                            {comp.exam_mode === "assessment" ? (
                              <Badge variant={comp.percent >= 70 ? "success" : "destructive"}>
                                {comp.percent >= 70 ? "Verified" : "Failed"}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <Link href={`/results/${comp.attempt_id}`}>
                              <span className="text-xs text-primary hover:underline cursor-pointer font-medium">
                                Review Attempt
                              </span>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No attempts completed yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Team-wide Knowledge Gaps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Team Knowledge Gap Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mgrLoading ? (
                <div className="text-sm text-muted-foreground">Loading gaps...</div>
              ) : mgrData?.gap_distribution && mgrData.gap_distribution.length > 0 ? (
                <div className="space-y-4">
                  {mgrData.gap_distribution.map((gap, index) => (
                    <div key={index} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate max-w-[180px]">{gap.knowledge_point_title}</span>
                        <span className="text-muted-foreground font-semibold">{gap.employee_count} {gap.employee_count === 1 ? "employee" : "employees"}</span>
                      </div>
                      <div className="w-full bg-accent rounded-full h-1.5">
                        <div 
                          className="bg-destructive h-1.5 rounded-full" 
                          style={{ width: `${Math.min(100, (gap.employee_count / (statsData?.employees_assessed || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No recurring team gaps found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {/* Global Actions Quick Bar */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>The knowledge verification loop</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  1
                </span>
                <span>
                  <strong>Upload</strong> internal docs (SOPs, playbooks, training)
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  2
                </span>
                <span>
                  <strong>AI extracts</strong> discrete knowledge points, grounded in source excerpts
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  3
                </span>
                <span>
                  <strong>Humans review</strong> each KP — approve, edit, or reject
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  4
                </span>
                <span>
                  <strong>Generate</strong> mixed-type questions from approved KPs + exam goal
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  5
                </span>
                <span>
                  <strong>Publish</strong> in either Practice (feedback enabled) or Assessment (official) mode
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  6
                </span>
                <span>
                  <strong>Analyze</strong> knowledge gaps and generate AI study recommendations
                </span>
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {currentUser.role === "admin" && (
              <>
                <Link href="/documents" className="flex items-center gap-2 rounded-md p-2 hover:bg-accent">
                  <FileText className="h-4 w-4" /> Upload a document
                </Link>
                <Link href="/knowledge" className="flex items-center gap-2 rounded-md p-2 hover:bg-accent">
                  <Brain className="h-4 w-4" /> Review knowledge points
                </Link>
              </>
            )}
            {(currentUser.role === "manager" || currentUser.role === "admin") && (
              <Link href="/assessments/new" className="flex items-center gap-2 rounded-md p-2 hover:bg-accent">
                <ListChecks className="h-4 w-4" /> Build an assessment
              </Link>
            )}
            <Link href="/exam" className="flex items-center gap-2 rounded-md p-2 hover:bg-accent">
              <GraduationCap className="h-4 w-4" /> Browse exams
            </Link>
            <div className="mt-2 flex items-center gap-2 rounded-md bg-success/10 p-2 text-success">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">Every AI output is human-reviewable.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
