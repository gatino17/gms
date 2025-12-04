from __future__ import annotations

from datetime import date, time, datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr
from decimal import Decimal


class TenantOut(BaseModel):
    id: int
    name: str
    slug: str
    contact_email: Optional[EmailStr] = None
    address: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_message: Optional[str] = None
    rooms_count: Optional[int] = None
    sidebar_theme: Optional[str] = None
    created_at: datetime
    admin_is_superuser: Optional[bool] = None

    class Config:
        from_attributes = True


class TenantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=6)
    address: Optional[str] = Field(default=None, max_length=255)
    country: Optional[str] = Field(default=None, max_length=80)
    city: Optional[str] = Field(default=None, max_length=120)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    phone: Optional[str] = Field(default=None, max_length=40)
    whatsapp_message: Optional[str] = None
    rooms_count: Optional[int] = None
    sidebar_theme: Optional[str] = None
    is_superuser: bool = False


class TenantUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(default=None, max_length=255)
    country: Optional[str] = Field(default=None, max_length=80)
    city: Optional[str] = Field(default=None, max_length=120)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    phone: Optional[str] = Field(default=None, max_length=40)
    whatsapp_message: Optional[str] = None
    rooms_count: Optional[int] = None
    sidebar_theme: Optional[str] = None
    is_superuser: Optional[bool] = None


class TenantSelfUpdate(BaseModel):
    address: Optional[str] = Field(default=None, max_length=255)
    country: Optional[str] = Field(default=None, max_length=80)
    city: Optional[str] = Field(default=None, max_length=120)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    phone: Optional[str] = Field(default=None, max_length=40)
    whatsapp_message: Optional[str] = None
    rooms_count: Optional[int] = None
    sidebar_theme: Optional[str] = None


class StudentBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    joined_at: Optional[date] = None
    birthdate: Optional[date] = None
    is_active: Optional[bool] = True


class StudentCreate(StudentBase):
    pass


class StudentUpdate(StudentBase):
    pass


class StudentOut(StudentBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class StudentStats(BaseModel):
    total_active: int = 0
    total_inactive: int = 0
    female: int = 0
    male: int = 0
    new_this_week: int = 0

class StudentListResponse(BaseModel):
    items: list[StudentOut]
    total: int
    stats: StudentStats


class CourseBase(BaseModel):
    name: str
    description: Optional[str] = None
    level: Optional[str] = None
    image_url: Optional[str] = None
    # Tipo y estructura del curso
    course_type: Optional[str] = None  # regular | choreography
    total_classes: Optional[int] = None
    classes_per_week: Optional[int] = None
    day_of_week: Optional[int] = Field(default=None, ge=0, le=6)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    # Segundo bloque semanal opcional
    day_of_week_2: Optional[int] = Field(default=None, ge=0, le=6)
    start_time_2: Optional[time] = None
    end_time_2: Optional[time] = None
    # Bloques 3-5 opcionales
    day_of_week_3: Optional[int] = Field(default=None, ge=0, le=6)
    start_time_3: Optional[time] = None
    end_time_3: Optional[time] = None
    day_of_week_4: Optional[int] = Field(default=None, ge=0, le=6)
    start_time_4: Optional[time] = None
    end_time_4: Optional[time] = None
    day_of_week_5: Optional[int] = Field(default=None, ge=0, le=6)
    start_time_5: Optional[time] = None
    end_time_5: Optional[time] = None
    room_id: Optional[int] = None
    teacher_id: Optional[int] = None
    start_date: Optional[date] = None
    max_capacity: Optional[int] = None
    price: Optional[Decimal] = None
    class_price: Optional[Decimal] = None
    is_active: Optional[bool] = True


class CourseCreate(CourseBase):
    pass


class CourseUpdate(CourseBase):
    pass


class CourseOut(CourseBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CourseListItem(BaseModel):
    id: int
    name: str
    level: Optional[str] = None
    image_url: Optional[str] = None
    course_type: Optional[str] = None
    classes_per_week: Optional[int] = None
    day_of_week: Optional[int] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    day_of_week_2: Optional[int] = None
    start_time_2: Optional[time] = None
    end_time_2: Optional[time] = None
    day_of_week_3: Optional[int] = None
    start_time_3: Optional[time] = None
    end_time_3: Optional[time] = None
    day_of_week_4: Optional[int] = None
    start_time_4: Optional[time] = None
    end_time_4: Optional[time] = None
    day_of_week_5: Optional[int] = None
    start_time_5: Optional[time] = None
    end_time_5: Optional[time] = None
    day_of_week_2: Optional[int] = None
    start_time_2: Optional[time] = None
    end_time_2: Optional[time] = None
    start_date: Optional[date] = None
    price: Optional[Decimal] = None
    class_price: Optional[Decimal] = None
    is_active: Optional[bool] = True
    teacher_name: Optional[str] = None
    room_name: Optional[str] = None

class CourseListResponse(BaseModel):
    items: list[CourseListItem]
    total: int



class PaymentBase(BaseModel):
    student_id: Optional[int] = None
    course_id: Optional[int] = None
    amount: Decimal
    payment_date: Optional[date] = None
    method: str
    type: str
    reference: Optional[str] = None
    notes: Optional[str] = None


class PaymentCreate(PaymentBase):
    pass


class PaymentUpdate(PaymentBase):
    pass


class PaymentOut(PaymentBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PaymentListResponse(BaseModel):
    items: list[PaymentOut]
    total: int

class PaymentByTeacher(BaseModel):
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    total: Decimal = Decimal(0)
    cash: Decimal = Decimal(0)
    card: Decimal = Decimal(0)
    transfer: Decimal = Decimal(0)
    agreement: Decimal = Decimal(0)


class PaymentByTeacherListResponse(BaseModel):
    items: list[PaymentByTeacher]
    total: int





