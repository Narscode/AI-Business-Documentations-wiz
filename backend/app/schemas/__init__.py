from .user import UserRead
from .document import DocumentRead, DocumentSummary
from .knowledge_point import (
    KnowledgePointCreate,
    KnowledgePointRead,
    KnowledgePointUpdate,
)
from .assessment import (
    AssessmentCreate,
    AssessmentRead,
    AssessmentDetail,
)
from .question import QuestionRead, QuestionUpdate
from .attempt import (
    AnswerSubmit,
    AnswerResult,
    AttemptQuestionView,
    AttemptRead,
    AttemptResult,
    KnowledgeGap,
    LearningRecommendation,
    SuggestedResource,
)
from .dashboard import (
    DashboardStats,
    EmployeeAttempt,
    EmployeeWeakTopic,
    EmployeeReadiness,
    EmployeeDashboardData,
    ManagerCompletion,
    ManagerGap,
    ManagerDashboardData,
)
from .coverage import CoverageItem, CoverageReport

__all__ = [
    "UserRead",
    "DocumentRead",
    "DocumentSummary",
    "KnowledgePointCreate",
    "KnowledgePointRead",
    "KnowledgePointUpdate",
    "AssessmentCreate",
    "AssessmentRead",
    "AssessmentDetail",
    "QuestionRead",
    "QuestionUpdate",
    "AnswerSubmit",
    "AnswerResult",
    "AttemptQuestionView",
    "AttemptRead",
    "AttemptResult",
    "KnowledgeGap",
    "LearningRecommendation",
    "SuggestedResource",
    "DashboardStats",
    "EmployeeAttempt",
    "EmployeeWeakTopic",
    "EmployeeReadiness",
    "EmployeeDashboardData",
    "ManagerCompletion",
    "ManagerGap",
    "ManagerDashboardData",
    "CoverageItem",
    "CoverageReport",
]
