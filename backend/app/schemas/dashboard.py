from datetime import datetime
from pydantic import BaseModel


class DashboardStats(BaseModel):
    documents_uploaded: int
    knowledge_points_extracted: int
    knowledge_points_approved: int
    assessments_created: int
    assessments_published: int
    employees_assessed: int
    questions_total: int
    questions_approved: int


class EmployeeAttempt(BaseModel):
    attempt_id: int
    assessment_id: int
    assessment_title: str
    total_score: float
    max_score: float
    percent: float
    status: str
    submitted_at: datetime | None


class EmployeeWeakTopic(BaseModel):
    knowledge_point_id: int
    title: str
    count: int


class EmployeeReadiness(BaseModel):
    assessment_id: int
    assessment_title: str
    readiness: str
    rationale: str


class EmployeeDashboardData(BaseModel):
    practice_attempts: list[EmployeeAttempt]
    official_attempts: list[EmployeeAttempt]
    weak_topics: list[EmployeeWeakTopic]
    readiness_predictions: list[EmployeeReadiness]


class ManagerCompletion(BaseModel):
    attempt_id: int
    employee_name: str
    assessment_title: str
    total_score: float
    max_score: float
    percent: float
    submitted_at: datetime | None
    exam_mode: str


class ManagerGap(BaseModel):
    knowledge_point_title: str
    employee_count: int


class ManagerDashboardData(BaseModel):
    completions: list[ManagerCompletion]
    gap_distribution: list[ManagerGap]
