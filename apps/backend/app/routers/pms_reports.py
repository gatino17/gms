from __future__ import annotations

from datetime import date
from decimal import Decimal
import unicodedata

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.pms.deps import get_db_session, get_tenant_id
from app.pms.models import Course, Enrollment, Payment, Student, Teacher

router = APIRouter(prefix="/api/pms/reports", tags=["pms-reports"])


def _to_ascii(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    return normalized.encode("ascii", "ignore").decode("ascii")


def _pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _fmt_date(value: date | None) -> str:
    if not value:
        return "-"
    return value.strftime("%d-%m-%Y")


def _fmt_money(value: Decimal | float | int | None) -> str:
    if value is None:
        return "$0"
    n = int(Decimal(value))
    return f"${n:,}".replace(",", ".")


def _payment_type_label(raw: str | None) -> str:
    t = (raw or "").lower()
    if t == "monthly":
        return "Mensualidad"
    if t == "single_class":
        return "Clase suelta"
    if t == "registration":
        return "Matricula"
    return t or "-"


def _build_pdf(stream_text: str) -> bytes:
    stream_bytes = stream_text.encode("latin-1", "replace")

    objects: list[bytes] = []
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    objects.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
    objects.append(
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n"
    )
    objects.append(b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
    objects.append(b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n")
    objects.append(
        b"6 0 obj\n<< /Length " + str(len(stream_bytes)).encode("ascii") + b" >>\nstream\n"
        + stream_bytes
        + b"\nendstream\nendobj\n"
    )

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)

    xref_pos = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        pdf.extend(f"{off:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        (
            "trailer\n"
            f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            "startxref\n"
            f"{xref_pos}\n"
            "%%EOF"
        ).encode("ascii")
    )
    return bytes(pdf)


@router.get("/student/{student_id}")
async def student_report_pdf(
    student_id: int,
    tenant_id: int = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db_session),
):
    sres = await db.execute(
        select(Student).where(Student.id == student_id, Student.tenant_id == tenant_id)
    )
    student = sres.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")

    eres = await db.execute(
        select(Enrollment, Course, Teacher)
        .join(Course, Course.id == Enrollment.course_id)
        .join(Teacher, Teacher.id == Course.teacher_id, isouter=True)
        .where(Enrollment.tenant_id == tenant_id, Enrollment.student_id == student_id)
        .order_by(Enrollment.start_date.desc())
    )
    enrollments = eres.all()

    pres = await db.execute(
        select(Payment, Course.name)
        .join(Course, Course.id == Payment.course_id, isouter=True)
        .where(Payment.tenant_id == tenant_id, Payment.student_id == student_id)
        .order_by(Payment.payment_date.desc(), Payment.created_at.desc())
        .limit(16)
    )
    payments = pres.all()

    registration_payments = [p for p, _ in payments if (p.type or "").lower() == "registration"]
    last_registration = registration_payments[0] if registration_payments else None
    enrollment_status = "Con matricula" if last_registration else "Sin matricula"
    enrollment_detail = (
        f"Ultimo cobro: {_fmt_date(last_registration.payment_date)}"
        if last_registration
        else "Sin cobros de matricula registrados"
    )

    commands: list[str] = []
    # Background blocks
    commands.append("0.97 0.97 0.99 rg 0 0 595 842 re f")
    commands.append("0.52 0.14 0.77 rg 0 760 595 82 re f")
    commands.append("1 1 1 rg 28 660 539 88 re f")
    commands.append("1 1 1 rg 28 560 539 88 re f")
    commands.append("1 1 1 rg 28 60 539 488 re f")
    commands.append("0.90 0.90 0.95 RG 1 w 28 60 539 688 re S")

    def add_text(x: int, y: int, txt: str, bold: bool = False, size: int = 10, gray: float = 0.15):
        font = "/F2" if bold else "/F1"
        safe = _pdf_escape(_to_ascii(txt))
        commands.append(f"BT {gray} g {font} {size} Tf 1 0 0 1 {x} {y} Tm ({safe}) Tj ET")

    # Header
    add_text(36, 812, "REPORTE DE ALUMNO", bold=True, size=16, gray=1.0)
    add_text(36, 790, f"{student.first_name} {student.last_name}  |  ID #{student.id}", size=10, gray=0.94)
    add_text(430, 790, f"Fecha: {_fmt_date(date.today())}", size=9, gray=0.94)

    # Card 1: Perfil
    add_text(40, 730, "PERFIL", bold=True, size=11, gray=0.26)
    add_text(40, 712, f"Telefono: {student.phone or '-'}", size=10, gray=0.20)
    add_text(230, 712, f"Email: {student.email or '-'}", size=10, gray=0.20)
    add_text(40, 694, f"Genero: {student.gender or '-'}", size=10, gray=0.20)
    add_text(230, 694, f"Miembro desde: {_fmt_date(student.joined_at)}", size=10, gray=0.20)

    # Card 2: Matricula
    add_text(40, 630, "MATRICULA", bold=True, size=11, gray=0.26)
    add_text(40, 612, f"Estado: {enrollment_status}", bold=True, size=11, gray=0.14)
    add_text(40, 594, enrollment_detail, size=10, gray=0.22)

    # Detail section
    add_text(40, 532, "CURSOS ACTIVOS / HISTORICOS", bold=True, size=11, gray=0.26)
    y = 514
    if not enrollments:
        add_text(40, y, "Sin cursos registrados.", size=10, gray=0.32)
        y -= 20
    else:
        for e, c, t in enrollments[:8]:
            teacher = t.name if t else "Sin profesor"
            row = f"- {c.name} | Profe: {teacher} | {_fmt_date(e.start_date)} a {_fmt_date(e.end_date)}"
            add_text(40, y, row, size=9, gray=0.20)
            y -= 15

    y -= 8
    add_text(40, y, "ULTIMOS PAGOS", bold=True, size=11, gray=0.26)
    y -= 18
    if not payments:
        add_text(40, y, "Sin pagos registrados.", size=10, gray=0.32)
    else:
        for p, course_name in payments[:10]:
            payment_type = (p.type or "").lower()
            if payment_type == "registration":
                row = (
                    f"- {_fmt_date(p.payment_date)} | *** MATRICULA *** | "
                    f"{p.method} | {_fmt_money(p.amount)}"
                )
            else:
                row = (
                    f"- {_fmt_date(p.payment_date)} | {course_name or '-'} | "
                    f"{_payment_type_label(p.type)} | {p.method} | {_fmt_money(p.amount)}"
                )
            add_text(40, y, row, size=9, gray=0.20)
            y -= 15
            if y < 84:
                add_text(40, y, "...", size=10, gray=0.35)
                break

    add_text(40, 32, "Documento generado por PMS", size=8, gray=0.45)

    pdf = _build_pdf("\n".join(commands))
    filename = f"reporte_alumno_{student.id}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
