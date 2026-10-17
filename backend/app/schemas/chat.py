import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.domain.chat import MAX_MESSAGE_LENGTH, HandoverStatus, MessageKind, Notice
from app.domain.incident import Severity, Status
from app.schemas.incident import AssigneeRead, StrictModel


class ChatIncidentRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    vehicle_id: str
    severity: Severity
    status: Status


class HandoverRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    status: HandoverStatus
    reason: str
    requester: AssigneeRead
    owner: AssigneeRead
    created_at: datetime
    resolved_at: datetime | None


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: MessageKind
    notice: Notice | None
    body: str
    author: AssigneeRead | None
    incident: ChatIncidentRef | None
    handover: HandoverRead | None
    created_at: datetime


class ChatHistory(BaseModel):
    items: list[ChatMessageRead] = Field(description="Em ordem cronológica.")
    has_more: bool


class ChatMessageCreate(StrictModel):
    body: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_MESSAGE_LENGTH)
    ]
    incident_id: uuid.UUID | None = None


class HandoverCreate(StrictModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] = ""


class DelegateRequest(StrictModel):
    to_user_id: uuid.UUID
    version: int = Field(ge=1)


class AnalystRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str
