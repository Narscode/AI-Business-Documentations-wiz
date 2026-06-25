from pydantic import BaseModel


class CoverageItem(BaseModel):
    knowledge_point_id: int
    knowledge_point_title: str
    question_count: int


class CoverageReport(BaseModel):
    assessment_id: int
    total_kps: int
    covered_kps: int
    coverage_pct: float
    covered: list[CoverageItem]
    uncovered: list[CoverageItem]
