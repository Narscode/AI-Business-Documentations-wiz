export type Role = "admin" | "manager" | "employee";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface DocumentSummary {
  id: number;
  title: string;
  original_filename: string;
  status: "uploaded" | "extracting" | "extracted" | "failed";
  created_at: string;
  kp_count: number;
  kp_approved: number;
}

export interface DocumentRead extends DocumentSummary {
  mime_type: string;
  error_message: string | null;
  content_preview: string;
}

export interface KnowledgePoint {
  id: number;
  document_id: number;
  document_title: string;
  title: string;
  description: string;
  source_excerpt: string;
  confidence: number;
  status: "pending" | "approved" | "rejected" | "edited";
  created_at: string;
  updated_at: string;
}

export type QuestionType = "mcq" | "multi" | "tf" | "open";

export interface Question {
  id: number;
  assessment_id: number;
  knowledge_point_id: number;
  knowledge_point_title: string;
  question_text: string;
  question_type: QuestionType;
  options_json: string[] | null;
  correct_answer_json: unknown;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface Assessment {
  id: number;
  title: string;
  goal: string;
  target_role: string;
  difficulty: "easy" | "medium" | "hard";
  question_count: number;
  status: "draft" | "published" | "closed";
  created_at: string;
  exam_mode: "practice" | "assessment";
  deadline_at: string | null;
  attempt_limit: number | null;
  show_answers: boolean;
  show_explanations: boolean;
  question_total: number;
  question_approved: number;
  attempt_count: number;
}

export interface AssessmentDetail extends Assessment {
  document_ids: number[];
  questions: Question[];
}

export interface AttemptQuestionView {
  id: number;
  question_text: string;
  question_type: QuestionType;
  options_json: string[] | null;
  difficulty: string;
}

export interface AttemptRead {
  id: number;
  assessment_id: number;
  assessment_title: string;
  employee_id: number;
  started_at: string;
  submitted_at: string | null;
  status: "in_progress" | "submitted";
  questions: AttemptQuestionView[];
  saved_answers: Record<number, unknown>;
}

export interface AnswerResult {
  question_id: number;
  question_text: string;
  question_type: QuestionType;
  options_json: string[] | null;
  correct_answer_json: unknown;
  explanation: string;
  employee_answer: unknown;
  is_correct: boolean;
  score: number;
  max_score: number;
  ai_rationale: string;
  ai_evidence: string;
  knowledge_point_id: number;
  knowledge_point_title: string;
}

export interface KnowledgeGap {
  knowledge_point_id: number;
  knowledge_point_title: string;
  document_title: string;
  questions_total: number;
  questions_wrong: number;
  avg_score: number;
  severity: "high" | "medium" | "low";
  summary: string;
}

export interface SuggestedResource {
  document_title: string;
  focus_area: string;
}

export interface LearningRecommendation {
  weak_topics: string[];
  next_steps: string[];
  suggested_resources: SuggestedResource[];
  encouragement: string;
}

export interface AttemptResult {
  attempt_id: number;
  assessment_title: string;
  exam_mode: "practice" | "assessment";
  total_score: number;
  max_score: number;
  percent: number;
  submitted_at: string | null;
  answers: AnswerResult[];
  gaps: KnowledgeGap[];
  recommendation: LearningRecommendation | null;
}

export interface CoverageItem {
  knowledge_point_id: number;
  knowledge_point_title: string;
  question_count: number;
}

export interface CoverageReport {
  assessment_id: number;
  total_kps: number;
  covered_kps: number;
  coverage_pct: number;
  covered: CoverageItem[];
  uncovered: CoverageItem[];
}

export interface DashboardStats {
  documents_uploaded: number;
  knowledge_points_extracted: number;
  knowledge_points_approved: number;
  assessments_created: number;
  assessments_published: number;
  employees_assessed: number;
  questions_total: number;
  questions_approved: number;
}

export interface EmployeeAttempt {
  attempt_id: number;
  assessment_id: number;
  assessment_title: string;
  total_score: number;
  max_score: number;
  percent: number;
  status: "in_progress" | "submitted";
  submitted_at: string | null;
}

export interface EmployeeWeakTopic {
  knowledge_point_id: number;
  title: string;
  count: number;
}

export interface EmployeeReadiness {
  assessment_id: number;
  assessment_title: string;
  readiness: "Ready" | "Moderately Ready" | "Needs Preparation";
  rationale: string;
}

export interface EmployeeDashboardData {
  practice_attempts: EmployeeAttempt[];
  official_attempts: EmployeeAttempt[];
  weak_topics: EmployeeWeakTopic[];
  readiness_predictions: EmployeeReadiness[];
}

export interface ManagerCompletion {
  attempt_id: number;
  employee_name: string;
  assessment_title: string;
  total_score: number;
  max_score: number;
  percent: number;
  submitted_at: string | null;
  exam_mode: "practice" | "assessment";
}

export interface ManagerGap {
  knowledge_point_title: string;
  employee_count: number;
}

export interface ManagerDashboardData {
  completions: ManagerCompletion[];
  gap_distribution: ManagerGap[];
}
