from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    document_text: str
    confidence_threshold: float = 0.3


class Redaction(BaseModel):
    id: str
    original_text: str
    pii_type: str
    confidence: float
    explanation: str
    context: str
    start: int
    end: int
    is_redacted: bool = True
    user_override: bool = False


class KeptItem(BaseModel):
    text: str
    resembles_type: str
    kept_reason: str


class ContextRisk(BaseModel):
    description: str
    risk_level: str
    suggestion: str


class AnalyzeResponse(BaseModel):
    redactions: list[Redaction]
    kept_items: list[KeptItem]
    metadata_warnings: list[str]
    context_risks: list[ContextRisk]
    trust_score: float
    category_breakdown: dict[str, int]


class ExportRequest(BaseModel):
    document_text: str
    redactions: list[Redaction]


class ExportResponse(BaseModel):
    safe_text: str
    safety_report: dict

class ExplainSelectionRequest(BaseModel):
    selection_text: str
    surrounding_context: str
    ai_redacted_tokens: list[str] = []
    manual_redacted_tokens: list[str] = []

class ExplainSelectionResponse(BaseModel):
    explanation: str
