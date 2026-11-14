from io import BytesIO
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Analysis, User
from ..schemas import AnalysisList, AnalysisOut
from ..storage import delete_image

router = APIRouter(prefix="/api/analyses", tags=["analyses"])


def _get_owned(analysis_id: int, user: User, db: Session) -> Analysis:
    record = db.get(Analysis, analysis_id)
    if record is None or record.user_id != user.id:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return record


@router.get("", response_model=AnalysisList)
def list_analyses(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnalysisList:
    total = db.scalar(select(func.count()).select_from(Analysis).where(Analysis.user_id == user.id)) or 0
    rows = db.scalars(
        select(Analysis)
        .where(Analysis.user_id == user.id)
        .order_by(Analysis.created_at.desc(), Analysis.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return AnalysisList(items=[AnalysisOut.model_validate(r) for r in rows], total=total)


@router.get("/{analysis_id}", response_model=AnalysisOut)
def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnalysisOut:
    return AnalysisOut.model_validate(_get_owned(analysis_id, user, db))


@router.delete("/{analysis_id}", status_code=204)
def delete_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    record = _get_owned(analysis_id, user, db)
    image_url = record.image_url
    db.delete(record)
    db.commit()
    delete_image(image_url)


@router.get("/{analysis_id}/pdf")
def export_pdf(
    analysis_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    record = _get_owned(analysis_id, user, db)
    pdf_bytes = _build_pdf(record.result_json, record.created_at.strftime("%B %d, %Y"))
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="facelens-report-{analysis_id}.pdf"'},
    )


def _build_pdf(result: dict, date_label: str) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="FaceLens Report",
    )

    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontSize=22,
        textColor=colors.HexColor("#4f46e5"),
        spaceAfter=4,
    )
    subtitle = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#6b7280"),
        spaceAfter=14,
    )
    heading = ParagraphStyle(
        "Heading",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=colors.HexColor("#111827"),
        spaceBefore=12,
        spaceAfter=6,
    )
    body = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=10,
        leading=15,
        textColor=colors.HexColor("#374151"),
    )
    small = ParagraphStyle(
        "Small",
        parent=styles["Normal"],
        fontSize=8,
        leading=12,
        textColor=colors.HexColor("#6b7280"),
    )

    story: list = [
        Paragraph("FaceLens Report", title),
        Paragraph(f"Generated {escape(date_label)}", subtitle),
    ]

    def add_paragraph(text: str) -> None:
        if text:
            story.append(Paragraph(escape(str(text)), body))

    def add_list(items: list | None) -> None:
        cleaned = [str(i).strip() for i in (items or []) if str(i).strip()]
        if not cleaned:
            return
        story.append(
            ListFlowable(
                [ListItem(Paragraph(escape(i), body), leftIndent=12) for i in cleaned],
                bulletType="bullet",
                start="circle",
                leftIndent=14,
                bulletFontSize=7,
            )
        )

    story.append(Paragraph("Overview", heading))
    add_paragraph(result.get("overall_description", ""))

    facts = [
        ("Estimated age range", result.get("estimated_age_range")),
        ("Facial shape", result.get("facial_shape")),
        ("Symmetry", result.get("symmetry_notes")),
    ]
    for label, value in facts:
        if value:
            add_paragraph(f"<b>{escape(label)}:</b> {escape(str(value))}")

    skin = result.get("skin") or {}
    if skin:
        story.append(Paragraph("Skin", heading))
        for label in ("tone", "texture"):
            if skin.get(label):
                add_paragraph(f"<b>{label.title()}:</b> {escape(str(skin[label]))}")
        concerns = skin.get("concerns") or []
        if concerns:
            add_paragraph("<b>Visible concerns:</b>")
            add_list(concerns)

    features = result.get("features") or {}
    if features:
        story.append(Paragraph("Features", heading))
        for label, value in features.items():
            if value:
                add_paragraph(f"<b>{label.title()}:</b> {escape(str(value))}")

    if result.get("strengths"):
        story.append(Paragraph("Strengths", heading))
        add_list(result.get("strengths"))

    if result.get("areas_to_improve"):
        story.append(Paragraph("Gentle focus areas", heading))
        add_list(result.get("areas_to_improve"))

    suggestions = result.get("suggestions") or {}
    groups = [
        ("Skincare", suggestions.get("skincare")),
        ("Grooming", suggestions.get("grooming")),
        ("Lifestyle", suggestions.get("lifestyle")),
        ("When to see a professional", suggestions.get("professional")),
    ]
    for label, items in groups:
        if items:
            story.append(Paragraph(label, heading))
            add_list(items)

    story.append(Spacer(1, 18))
    story.append(
        Paragraph(
            escape(result.get("disclaimer", "This is a general wellness analysis, not medical advice.")),
            small,
        )
    )

    doc.build(story)
    return buffer.getvalue()
