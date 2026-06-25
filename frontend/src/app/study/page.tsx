"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { 
  BookOpen, 
  FileText, 
  Brain, 
  AlertTriangle, 
  CheckCircle2, 
  GraduationCap, 
  ChevronRight,
  ChevronDown,
  Search,
  Sparkles,
  Check,
  RotateCcw,
  HelpCircle,
  X,
  Award
} from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "@/lib/user-context";
import type { DocumentSummary, KnowledgePoint, EmployeeDashboardData, Question } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function StudyCenterPage() {
  const { currentUser } = useUser();
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [kpSearchQuery, setKpSearchQuery] = useState("");
  const [expandedKpId, setExpandedKpId] = useState<number | null>(null);
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);

  // Gamification & Study State
  const [masteredKpIds, setMasteredKpIds] = useState<Set<number>>(new Set());
  const [revealedQuestionIds, setRevealedQuestionIds] = useState<Set<number>>(new Set());
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [userAnswersText, setUserAnswersText] = useState<Record<number, string>>({});
  const [gradedAnswers, setGradedAnswers] = useState<Record<number, { score: number; rationale: string; graded: boolean }>>({});

  // 1. Load mastered KPs from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("kvp.masteredKps");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setMasteredKpIds(new Set(parsed.map(Number)));
          }
        } catch (e) {
          console.error("Failed to load mastered KPs", e);
        }
      }
    }
  }, []);

  // Sync mastered KPs to localStorage
  const toggleMastery = (kpId: number) => {
    const next = new Set(masteredKpIds);
    if (next.has(kpId)) {
      next.delete(kpId);
    } else {
      next.add(kpId);
    }
    setMasteredKpIds(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kvp.masteredKps", JSON.stringify(Array.from(next)));
    }
  };

  // 2. Fetch all documents (playbooks)
  const { data: docs, isLoading: docsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => api<DocumentSummary[]>("/api/documents"),
  });

  // 3. Fetch all approved knowledge points
  const { data: allKps, isLoading: kpsLoading } = useQuery({
    queryKey: ["all-knowledge-points"],
    queryFn: () => api<KnowledgePoint[]>("/api/knowledge-points?status=approved"),
  });

  // 4. Fetch employee dashboard to check for active gaps (if user is employee)
  const { data: empData } = useQuery({
    queryKey: ["dashboard-employee"],
    queryFn: () => api<EmployeeDashboardData>("/api/dashboard/employee"),
    enabled: currentUser?.role === "employee",
  });

  // 5. Fetch all questions to power study flashcards
  const { data: allQuestions, isLoading: questionsLoading } = useQuery({
    queryKey: ["all-study-questions"],
    queryFn: () => api<Question[]>("/api/questions?status=approved"),
  });

  // Extract list of weak knowledge point IDs for active gap highlighting
  const weakKpIds = useMemo(() => {
    return new Set((empData?.weak_topics ?? []).map((t) => t.knowledge_point_id));
  }, [empData]);

  // Map weak topics details for quick study reference on home state
  const weakKpDetails = useMemo(() => {
    if (!allKps || !empData?.weak_topics) return [];
    return empData.weak_topics.map((wt) => {
      const kp = allKps.find((k) => k.id === wt.knowledge_point_id);
      return {
        ...wt,
        document_id: kp?.document_id,
        document_title: kp?.document_title,
        description: kp?.description
      };
    });
  }, [allKps, empData]);

  // Fetch individual document text preview when a document is selected
  const { data: docDetail, isLoading: docDetailLoading } = useQuery({
    queryKey: ["document-detail", selectedDocId],
    queryFn: () => api<{ content_preview: string }>(`/api/documents/${selectedDocId}`),
    enabled: selectedDocId !== null,
  });

  // Filters
  const filteredDocs = useMemo(() => {
    return (docs ?? []).filter((doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [docs, searchQuery]);

  const selectedDoc = useMemo(() => {
    return (docs ?? []).find((d) => d.id === selectedDocId) || null;
  }, [docs, selectedDocId]);

  const documentKps = useMemo(() => {
    if (!selectedDocId || !allKps) return [];
    return allKps.filter((kp) => kp.document_id === selectedDocId);
  }, [allKps, selectedDocId]);

  const filteredKps = useMemo(() => {
    return documentKps.filter((kp) =>
      kp.title.toLowerCase().includes(kpSearchQuery.toLowerCase()) ||
      kp.description.toLowerCase().includes(kpSearchQuery.toLowerCase())
    );
  }, [documentKps, kpSearchQuery]);

  // Calculate overall mastery percentage of current document
  const docMasteryStats = useMemo(() => {
    if (documentKps.length === 0) return { count: 0, percent: 0 };
    const mastered = documentKps.filter((kp) => masteredKpIds.has(kp.id)).length;
    return {
      count: mastered,
      percent: Math.round((mastered / documentKps.length) * 100),
    };
  }, [documentKps, masteredKpIds]);

  // Handle flashcard answer checking
  const handleAnswerSelect = (questionId: number, answerValue: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: answerValue }));
  };

  const handleRevealAnswer = (questionId: number) => {
    setRevealedQuestionIds((prev) => {
      const next = new Set(prev);
      next.add(questionId);
      return next;
    });
  };

  const handleResetFlashcard = (questionId: number) => {
    setRevealedQuestionIds((prev) => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
    setSelectedAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setUserAnswersText((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setGradedAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  // Mock AI grading for open-ended flashcard response
  const handleGradeOpenAnswer = (questionId: number, correctAnswer: string) => {
    const text = userAnswersText[questionId] || "";
    if (!text.trim()) return;

    // Simulate basic check (matching key terminology)
    const keywords = correctAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const textLower = text.toLowerCase();
    let matches = 0;
    keywords.forEach(kw => {
      if (textLower.includes(kw)) matches++;
    });

    const matchPct = keywords.length > 0 ? (matches / keywords.length) : 1;
    let score = 0;
    let rationale = "";

    if (matchPct > 0.5) {
      score = 1.0;
      rationale = "Excellent explanation. Your response successfully details the operational constraints and references the core verification guidelines correctly.";
    } else if (matchPct > 0.1) {
      score = 0.5;
      rationale = "Partially correct. You identified the main concept, but missed key steps (e.g. specific verification tiers or window periods) noted in the correct answer.";
    } else {
      score = 0.0;
      rationale = "Incorrect. The response does not cover the primary operational steps detailed in the playbook rules. Review the correct answer details below.";
    }

    setGradedAnswers((prev) => ({
      ...prev,
      [questionId]: { score, rationale, graded: true }
    }));
    handleRevealAnswer(questionId);
  };

  const handleJumpToKp = (docId: number, kpId: number) => {
    setSelectedDocId(docId);
    setExpandedKpId(kpId);
    setKpSearchQuery("");
    setShowDocumentPreview(false);
    // Smooth scroll to the target knowledge point
    setTimeout(() => {
      const el = document.getElementById(`kp-card-${kpId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const activeGapsCount = (docs ?? []).reduce((acc, d) => {
    if (!allKps) return acc;
    const docKpIds = allKps.filter((kp) => kp.document_id === d.id).map((k) => k.id);
    const gaps = docKpIds.filter((id) => weakKpIds.has(id)).length;
    return acc + gaps;
  }, 0);

  return (
    <div className="mx-auto max-w-7xl font-sans">
      {/* Title Banner */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 bg-clip-text text-transparent flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-indigo-600" />
            Study & Learning Center
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Read business playbooks, review AI-extracted knowledge points, and test your understanding with adaptive flashcards.
          </p>
        </div>
        {selectedDocId !== null && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setSelectedDocId(null); setExpandedKpId(null); }}
            className="flex items-center gap-1.5 self-start md:self-auto"
          >
            ← Back to Library Overview
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        
        {/* ================= LEFT SIDEBAR: PLAYBOOKS LIST ================= */}
        <div className="space-y-4 lg:col-span-1">
          <Card className="border border-indigo-100/60 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold text-foreground/80 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-indigo-500" />
                Playbook Modules
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter playbooks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>

              {docsLoading ? (
                <div className="space-y-2 py-4">
                  <div className="h-8 bg-muted rounded-md animate-pulse" />
                  <div className="h-8 bg-muted rounded-md animate-pulse" />
                  <div className="h-8 bg-muted rounded-md animate-pulse" />
                </div>
              ) : filteredDocs.length > 0 ? (
                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                  {filteredDocs.map((doc) => {
                    const isActive = doc.id === selectedDocId;
                    const docKpsList = allKps ? allKps.filter((kp) => kp.document_id === doc.id) : [];
                    const docMastered = docKpsList.filter((kp) => masteredKpIds.has(kp.id)).length;
                    const isFullyMastered = docKpsList.length > 0 && docMastered === docKpsList.length;
                    const docGapsCount = docKpsList.filter((kp) => weakKpIds.has(kp.id)).length;

                    return (
                      <button
                        key={doc.id}
                        onClick={() => { setSelectedDocId(doc.id); setExpandedKpId(null); }}
                        className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex flex-col gap-2 ${
                          isActive
                            ? "border-indigo-500 bg-indigo-50/40 shadow-sm text-indigo-955 font-medium"
                            : "border-border hover:bg-accent/40 text-foreground/80"
                        }`}
                      >
                        <div className="flex items-start justify-between w-full">
                          <span className="font-semibold line-clamp-2 pr-1">{doc.title}</span>
                          {docGapsCount > 0 && (
                            <Badge variant="destructive" className="shrink-0 text-[9px] px-1.5 py-0.5 animate-bounce">
                              {docGapsCount} Gap{docGapsCount > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground w-full">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {doc.kp_approved} concepts
                          </span>
                          
                          {docKpsList.length > 0 && (
                            <span className={`flex items-center gap-1 font-medium ${isFullyMastered ? "text-success" : "text-muted-foreground"}`}>
                              {isFullyMastered ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 text-success" />
                                  Mastered
                                </>
                              ) : (
                                `${docMastered}/${docKpsList.length} mastered`
                              )}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No documents found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ================= RIGHT CANVAS: DETAILS OR PORTAL INTERFACE ================= */}
        <div className="lg:col-span-3 space-y-6">

          {selectedDocId === null ? (
            /* ================= 1. PORTAL EMPTY STATE (NO SELECTION) ================= */
            <div className="space-y-6">
              
              {/* Premium Hero Banner */}
              <Card className="border-indigo-100 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white overflow-hidden relative shadow-md">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
                <CardContent className="p-8 space-y-4">
                  <Badge className="bg-indigo-500/20 border-indigo-400/30 text-indigo-300 font-medium">
                    Learning Loop Complete
                  </Badge>
                  <h2 className="text-2xl font-bold tracking-tight leading-snug">
                    Accelerate Capability Verification
                  </h2>
                  <p className="text-indigo-200/80 text-sm max-w-2xl leading-relaxed">
                    Select a playbook module on the left side menu to review verified guidelines, explore the AI Traceability Engine source excerpts, and check your compliance readiness.
                  </p>
                  
                  {/* Global Stats bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-indigo-800/40 text-left">
                    <div>
                      <p className="text-[10px] text-indigo-300 uppercase tracking-wider font-semibold">Total Playbooks</p>
                      <p className="text-2xl font-bold text-white mt-1">{docs?.length ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-indigo-300 uppercase tracking-wider font-semibold">Approved Concepts</p>
                      <p className="text-2xl font-bold text-white mt-1">{allKps?.length ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-indigo-300 uppercase tracking-wider font-semibold">My Active Gaps</p>
                      <p className={`text-2xl font-bold mt-1 ${activeGapsCount > 0 ? "text-rose-400" : "text-white"}`}>
                        {activeGapsCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-indigo-300 uppercase tracking-wider font-semibold">Concepts Mastered</p>
                      <p className="text-2xl font-bold text-emerald-400 mt-1">{masteredKpIds.size}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Active Knowledge Gaps Panel (Employee view priority) */}
              {currentUser?.role === "employee" && (
                <Card className="border-rose-100 shadow-sm">
                  <CardHeader className="bg-rose-50/30 border-b border-rose-100/50 p-5">
                    <CardTitle className="text-base text-rose-950 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-rose-600" />
                      Active Gaps Requiring Study Focus
                    </CardTitle>
                    <CardDescription className="text-rose-900/60 text-xs">
                      These topics were missed in your practice or assessment attempts. Click a gap below to immediately study its source reference.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    {weakKpDetails.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {weakKpDetails.map((wt) => (
                          <div 
                            key={wt.knowledge_point_id}
                            className="p-4 rounded-xl border border-rose-100 bg-rose-50/10 hover:bg-rose-50/20 transition-all flex flex-col justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Badge variant="destructive" className="text-[9px] font-semibold py-0.5">
                                  Gap Count: {wt.count}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                  {wt.document_title}
                                </span>
                              </div>
                              <h4 className="font-semibold text-rose-955 text-sm leading-snug">{wt.title}</h4>
                              <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                                {wt.description || "No definition specified."}
                              </p>
                            </div>

                            {wt.document_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleJumpToKp(wt.document_id!, wt.knowledge_point_id)}
                                className="w-full text-rose-800 hover:text-rose-950 hover:bg-rose-50 border-rose-200/50 mt-1 flex items-center justify-center gap-1 text-[11px] h-8 font-medium"
                              >
                                <Brain className="h-3 w-3" />
                                Study Source Excerpt
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                        <h4 className="font-semibold text-emerald-950 text-sm">Perfect Standing!</h4>
                        <p className="text-muted-foreground text-xs max-w-sm">
                          No knowledge gaps identified on the platform. All evaluations are fully verified.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Study Recommendations Quick Box */}
              <Card className="border border-indigo-100/60 shadow-sm">
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="text-base text-foreground/80 flex items-center gap-2">
                    <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
                    How to study effectively
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-4 rounded-lg bg-accent/40 border space-y-1">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-semibold mb-2">1</div>
                      <h4 className="font-semibold text-foreground/90">Expand Playbook KPs</h4>
                      <p className="text-muted-foreground leading-relaxed">Read approved definitions and core procedures verified by Content Admins.</p>
                    </div>
                    <div className="p-4 rounded-lg bg-accent/40 border space-y-1">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-semibold mb-2">2</div>
                      <h4 className="font-semibold text-foreground/90">Trace with Excerpts</h4>
                      <p className="text-muted-foreground leading-relaxed">View the exact highlighted sentence from the original business document to trace context.</p>
                    </div>
                    <div className="p-4 rounded-lg bg-accent/40 border space-y-1">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-semibold mb-2">3</div>
                      <h4 className="font-semibold text-foreground/90">Test with Flashcards</h4>
                      <p className="text-muted-foreground leading-relaxed">Check understanding interactively, view immediate grader feedback, and mark concepts as mastered.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          ) : (
            /* ================= 2. ACTIVE DOCUMENT STUDY WORKSPACE ================= */
            <div className="space-y-6">
              
              {/* Playbook Header & Progress Card */}
              <Card className="border border-indigo-100/60 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Active Module</span>
                      <h2 className="text-lg font-bold text-slate-900 leading-snug">{selectedDoc?.title}</h2>
                    </div>

                    <div className="w-full sm:w-[220px] shrink-0 space-y-2">
                      <div className="flex justify-between items-center text-[11px] font-semibold text-slate-800">
                        <span className="flex items-center gap-1">
                          <Award className="h-3.5 w-3.5 text-amber-500" />
                          Mastery Progress
                        </span>
                        <span>{docMasteryStats.percent}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${docMasteryStats.percent}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground text-right">
                        {docMasteryStats.count} of {documentKps.length} concepts mastered
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Source Document Text Reader Drawer */}
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader 
                  className="p-4 flex flex-row items-center justify-between cursor-pointer hover:bg-slate-50/40 select-none transition-colors"
                  onClick={() => setShowDocumentPreview(!showDocumentPreview)}
                >
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                      <FileText className="h-4 w-4 text-slate-500" />
                      Original Document Text Viewer
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Read raw source content parsed from parsed upload attachment.
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {showDocumentPreview ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                {showDocumentPreview && (
                  <CardContent className="p-4 border-t bg-slate-50/30">
                    {docDetailLoading ? (
                      <div className="text-center py-6 text-xs text-muted-foreground animate-pulse">
                        Loading file content...
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg border p-4 max-h-[300px] overflow-y-auto font-mono text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap select-all">
                        {docDetail?.content_preview || "Original text content could not be previewed."}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* Knowledge Points Workspace Header */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-1.5">
                      <Brain className="h-4.5 w-4.5 text-indigo-500" />
                      Approved Knowledge Points ({documentKps.length})
                    </h3>
                    <p className="text-[11px] text-muted-foreground">Expand a point to view grounded excerpts and self-study flashcards.</p>
                  </div>
                  <div className="relative w-full sm:w-[240px]">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Filter concepts..."
                      value={kpSearchQuery}
                      onChange={(e) => setKpSearchQuery(e.target.value)}
                      className="pl-8 h-9 text-xs"
                    />
                  </div>
                </div>

                {filteredKps.length > 0 ? (
                  <div className="space-y-4">
                    {filteredKps.map((kp) => {
                      const isExpanded = expandedKpId === kp.id;
                      const isMastered = masteredKpIds.has(kp.id);
                      const hasActiveGap = weakKpIds.has(kp.id);

                      // Find all approved questions matching this knowledge point
                      const kpQuestions = (allQuestions ?? []).filter((q) => q.knowledge_point_id === kp.id);
                      const activeQuestion = kpQuestions[0] || null; // Focus on the primary review question

                      return (
                        <div
                          key={kp.id}
                          id={`kp-card-${kp.id}`}
                          className={`rounded-xl border transition-all duration-350 ${
                            isMastered
                              ? "border-emerald-200 bg-emerald-50/5"
                              : hasActiveGap
                              ? "border-rose-200 bg-rose-50/5 shadow-sm shadow-rose-100/10"
                              : "border-slate-200 bg-white"
                          } ${isExpanded ? "shadow-md ring-1 ring-indigo-500/10" : "hover:shadow-sm"}`}
                        >
                          {/* Accordion Card Header */}
                          <div
                            onClick={() => setExpandedKpId(isExpanded ? null : kp.id)}
                            className="p-4 flex items-start justify-between gap-4 cursor-pointer select-none"
                          >
                            <div className="flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="text-[9px] font-semibold tracking-wider uppercase text-muted-foreground border-slate-200 bg-slate-50">
                                  KP #{kp.id}
                                </Badge>
                                {hasActiveGap && (
                                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0 bg-rose-600 text-white font-medium hover:bg-rose-600">
                                    ⚠️ Active Gap
                                  </Badge>
                                )}
                                {isMastered && (
                                  <Badge variant="success" className="text-[9px] px-1.5 py-0 flex items-center gap-0.5">
                                    <Check className="h-2.5 w-2.5" />
                                    Mastered
                                  </Badge>
                                )}
                                <span className="text-[10px] text-indigo-600 font-medium bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/50">
                                  {Math.round(kp.confidence * 100)}% AI Confidence
                                </span>
                              </div>
                              
                              <h4 className={`text-sm font-bold leading-snug ${isMastered ? "text-emerald-955" : hasActiveGap ? "text-rose-955" : "text-slate-900"}`}>
                                {kp.title}
                              </h4>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 pt-1">
                              {/* Quick check/uncheck mastery button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMastery(kp.id);
                                }}
                                className={`h-7 w-7 rounded-full border flex items-center justify-center transition-all ${
                                  isMastered
                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                    : "border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"
                                }`}
                                title={isMastered ? "Mark as unmastered" : "Mark as mastered"}
                              >
                                <Check className="h-4 w-4" />
                              </button>

                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>

                          {/* Accordion Card Body Details */}
                          {isExpanded && (
                            <div className="p-4 pt-0 border-t border-slate-100 space-y-4 text-xs">
                              
                              {/* Warning Gap Callout */}
                              {hasActiveGap && (
                                <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-955 flex gap-2.5 leading-relaxed">
                                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                                  <div className="space-y-1">
                                    <p className="font-semibold text-[11px]">Knowledge Gap Identified</p>
                                    <p className="text-rose-900/80 text-[10px]">
                                      You have recently failed questions involving this specific operational guide. Carefully review the source excerpt and verify your understanding below.
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Concept Description */}
                              <div className="space-y-1">
                                <h5 className="font-semibold text-[11px] uppercase tracking-wider text-slate-400">Concept Definition</h5>
                                <p className="text-slate-700 leading-relaxed text-sm bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                                  {kp.description || "No description provided."}
                                </p>
                              </div>

                              {/* Traceability excerpt */}
                              <div className="space-y-2">
                                <h5 className="font-semibold text-indigo-955 text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  Original Source Excerpt (Grounded Traceability)
                                </h5>
                                <div className="p-4 rounded-lg border border-indigo-100/50 bg-indigo-50/10 border-l-4 border-l-indigo-600 font-serif italic text-slate-700 leading-relaxed select-all">
                                  "{kp.source_excerpt || "No source excerpt parsed."}"
                                </div>
                              </div>

                              {/* Interactive Self-study Flashcard Section */}
                              <div className="pt-3 border-t border-slate-100">
                                <Card className="border border-indigo-100 bg-indigo-50/5">
                                  <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-xs font-semibold text-indigo-955 flex items-center gap-1.5">
                                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                                      AI Study Flashcard: Self-Evaluation Portal
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="p-4 pt-0 space-y-4">
                                    {questionsLoading ? (
                                      <div className="text-center py-4 text-muted-foreground animate-pulse">
                                        Loading study cards...
                                      </div>
                                    ) : activeQuestion ? (
                                      /* Display actual verified question as a study check */
                                      <div className="space-y-3">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[9px] px-1 bg-indigo-100 text-indigo-800 uppercase font-medium">
                                              {activeQuestion.question_type} Check
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground">Difficulty: {activeQuestion.difficulty}</span>
                                          </div>
                                          <p className="font-medium text-slate-800 text-[13px] leading-snug">
                                            {activeQuestion.question_text}
                                          </p>
                                        </div>

                                        {/* Dynamic interactive input based on type */}
                                        {activeQuestion.question_type === "open" ? (
                                          <div className="space-y-2">
                                            <textarea
                                              value={userAnswersText[activeQuestion.id] ?? ""}
                                              onChange={(e) => setUserAnswersText((prev) => ({ ...prev, [activeQuestion.id]: e.target.value }))}
                                              placeholder="Type your explanation answer here..."
                                              rows={3}
                                              className="w-full text-xs p-3 rounded-lg border border-slate-200 bg-white placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                              disabled={revealedQuestionIds.has(activeQuestion.id)}
                                            />
                                            {!revealedQuestionIds.has(activeQuestion.id) && (
                                              <Button
                                                size="sm"
                                                onClick={() => handleGradeOpenAnswer(activeQuestion.id, String(activeQuestion.correct_answer_json))}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[11px] h-8"
                                                disabled={!(userAnswersText[activeQuestion.id] ?? "").trim()}
                                              >
                                                Submit response to AI grader
                                              </Button>
                                            )}
                                          </div>
                                        ) : (
                                          /* MCQ / Multi Select / True False Options */
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {(activeQuestion.options_json || ["True", "False"]).map((opt, optIdx) => {
                                              const optVal = String(opt);
                                              const isSelected = selectedAnswers[activeQuestion.id] === optVal;
                                              const isRevealed = revealedQuestionIds.has(activeQuestion.id);
                                              
                                              // Determine correctness representation
                                              let optStyle = "border-slate-200 hover:border-indigo-400 bg-white text-slate-800";
                                              if (isSelected) {
                                                optStyle = "border-indigo-600 bg-indigo-50/50 text-indigo-955 font-medium";
                                              }
                                              if (isRevealed) {
                                                const isCorrectVal = Array.isArray(activeQuestion.correct_answer_json) 
                                                  ? activeQuestion.correct_answer_json.map(String).includes(optVal)
                                                  : String(activeQuestion.correct_answer_json) === optVal;

                                                if (isCorrectVal) {
                                                  optStyle = "border-emerald-500 bg-emerald-50 text-emerald-955 font-semibold";
                                                } else if (isSelected) {
                                                  optStyle = "border-rose-500 bg-rose-50 text-rose-955";
                                                } else {
                                                  optStyle = "border-slate-100 bg-slate-50/30 text-slate-400 opacity-60";
                                                }
                                              }

                                              return (
                                                <button
                                                  key={optIdx}
                                                  disabled={isRevealed}
                                                  onClick={() => handleAnswerSelect(activeQuestion.id, optVal)}
                                                  className={`p-3 rounded-lg border text-left text-xs transition-all flex items-start gap-2 ${optStyle}`}
                                                >
                                                  {isRevealed ? (
                                                    (Array.isArray(activeQuestion.correct_answer_json) 
                                                      ? activeQuestion.correct_answer_json.map(String).includes(optVal)
                                                      : String(activeQuestion.correct_answer_json) === optVal) ? (
                                                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                                    ) : isSelected ? (
                                                      <X className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                                    ) : (
                                                      <div className="h-4 w-4 rounded-full border border-slate-200 shrink-0 mt-0.5" />
                                                    )
                                                  ) : (
                                                    <div className={`h-4 w-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>
                                                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                                    </div>
                                                  )}
                                                  <span>{opt}</span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}

                                        {/* Action buttons (MCQ check) */}
                                        {activeQuestion.question_type !== "open" && !revealedQuestionIds.has(activeQuestion.id) && (
                                          <Button
                                            size="sm"
                                            onClick={() => handleRevealAnswer(activeQuestion.id)}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[11px] h-8"
                                            disabled={!selectedAnswers[activeQuestion.id]}
                                          >
                                            Reveal correct answer
                                          </Button>
                                        )}

                                        {/* Revealed Result Panel */}
                                        {revealedQuestionIds.has(activeQuestion.id) && (
                                          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2.5">
                                            {activeQuestion.question_type === "open" && gradedAnswers[activeQuestion.id] && (
                                              <div className="p-2 rounded border bg-indigo-50 border-indigo-100 flex flex-col gap-1 text-[11px]">
                                                <span className="font-semibold text-indigo-900 flex items-center gap-1">
                                                  <Sparkles className="h-3.5 w-3.5" />
                                                  AI Grader Evaluation (Score: {gradedAnswers[activeQuestion.id].score.toFixed(1)} / 1.0)
                                                </span>
                                                <p className="text-indigo-955/80 italic font-medium">
                                                  "{gradedAnswers[activeQuestion.id].rationale}"
                                                </p>
                                              </div>
                                            )}

                                            <div className="space-y-1">
                                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                                {activeQuestion.question_type === "open" ? "Answer guidelines / Rationale" : "Explanation"}
                                              </span>
                                              <p className="text-slate-800 leading-relaxed font-semibold">
                                                {activeQuestion.explanation || "No explanation provided."}
                                              </p>
                                            </div>

                                            {activeQuestion.question_type === "open" && (
                                              <div className="space-y-1 border-t pt-2 mt-1">
                                                <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide">Key Points Guide</span>
                                                <p className="text-indigo-900 font-mono text-[11px] whitespace-pre-wrap leading-normal">
                                                  {String(activeQuestion.correct_answer_json)}
                                                </p>
                                              </div>
                                            )}

                                            <div className="flex gap-2 justify-end pt-1">
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleResetFlashcard(activeQuestion.id)}
                                                className="h-8 text-[10px] flex items-center gap-1"
                                              >
                                                <RotateCcw className="h-3 w-3" />
                                                Reset card
                                              </Button>
                                              {!isMastered && (
                                                <Button
                                                  size="sm"
                                                  onClick={() => {
                                                    toggleMastery(kp.id);
                                                  }}
                                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[10px] h-8 flex items-center gap-1"
                                                >
                                                  <Check className="h-3 w-3" />
                                                  Mark concept mastered
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                      </div>
                                    ) : (
                                      /* No matching question in DB: provide quick conceptual card summary */
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="secondary" className="text-[9px] px-1 bg-amber-100 text-amber-800 uppercase font-medium">
                                            Takeaway Summary
                                          </Badge>
                                          <span className="text-[10px] text-muted-foreground">Self-Study Mode</span>
                                        </div>

                                        <p className="font-semibold text-slate-800 leading-snug text-[12px]">
                                          Explain the core business implication: {kp.title}
                                        </p>

                                        {!revealedQuestionIds.has(kp.id) ? (
                                          <Button
                                            size="sm"
                                            onClick={() => handleRevealAnswer(kp.id)}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[11px] h-8"
                                          >
                                            Verify understanding
                                          </Button>
                                        ) : (
                                          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2.5 animate-fadeIn">
                                            <p className="text-slate-800 leading-relaxed text-[11px]">
                                              <strong>Core verification guideline:</strong> Ensure you understand the definition, constraints, and source context listed above. If you can confidently explain this concept, mark it as mastered.
                                            </p>
                                            
                                            <div className="flex gap-2 justify-end pt-1">
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleResetFlashcard(kp.id)}
                                                className="h-8 text-[10px] flex items-center gap-1"
                                              >
                                                <RotateCcw className="h-3 w-3" />
                                                Reset card
                                              </Button>
                                              {!isMastered && (
                                                <Button
                                                  size="sm"
                                                  onClick={() => toggleMastery(kp.id)}
                                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[10px] h-8 flex items-center gap-1"
                                                >
                                                  <Check className="h-3 w-3" />
                                                  Mark concept mastered
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              </div>

                              {/* Star / Unstar Mastery Button */}
                              <div className="flex justify-end pt-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleMastery(kp.id)}
                                  className={`text-[11px] h-8 font-medium flex items-center gap-1.5 ${
                                    isMastered ? "text-emerald-700 hover:bg-emerald-50" : "text-indigo-600 hover:bg-indigo-50"
                                  }`}
                                >
                                  <Check className={`h-4 w-4 ${isMastered ? "text-emerald-600" : "text-indigo-400"}`} />
                                  {isMastered ? "Mastered" : "Mark as Mastered"}
                                </Button>
                              </div>

                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 border border-dashed rounded-xl bg-white space-y-2">
                    <HelpCircle className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                    <h4 className="font-semibold text-slate-800 text-sm">No Concepts Filtered</h4>
                    <p className="text-muted-foreground text-xs max-w-xs mx-auto">
                      Adjust your search query to locate approved knowledge points.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
