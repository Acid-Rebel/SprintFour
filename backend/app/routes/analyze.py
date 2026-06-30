"""
Analyze route — accepts document text, runs PII detection, returns results.
"""

from fastapi import APIRouter, HTTPException

from ..models.schemas import AnalyzeRequest, AnalyzeResponse, ExplainSelectionRequest, ExplainSelectionResponse
from ..services.pii_detector import detect_pii, explain_selection_status

router = APIRouter(prefix="/api", tags=["analyze"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_document(req: AnalyzeRequest):
    """Detect PII in the submitted document text via Gemini."""
    if not req.document_text.strip():
        raise HTTPException(status_code=400, detail="Document text is empty.")

    try:
        result = await detect_pii(req.document_text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PII detection failed: {exc}")

    # Apply confidence threshold — mark low-confidence items as not redacted
    for r in result["redactions"]:
        if r["confidence"] < req.confidence_threshold:
            r["is_redacted"] = False

    return result

@router.post("/explain-selection", response_model=ExplainSelectionResponse)
async def explain_selection(req: ExplainSelectionRequest):
    """Provide an AI explanation of why a specific text selection was or wasn't redacted."""
    try:
        explanation = await explain_selection_status(
            selection_text=req.selection_text,
            context=req.surrounding_context,
            ai_redacted_tokens=req.ai_redacted_tokens,
            manual_redacted_tokens=req.manual_redacted_tokens
        )
        return ExplainSelectionResponse(explanation=explanation)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Explanation failed: {exc}")
