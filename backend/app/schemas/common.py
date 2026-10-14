from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

T = TypeVar("T")


class Envelope(BaseModel, Generic[T]):
    success: bool = True
    data: T
    meta: dict[str, Any] | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    name: str
    designation: str | None = None
    timezone: str
    role: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterIn(BaseModel):
    email: str = Field(examples=["lead@example.com"])
    password: str = Field(min_length=12, examples=["ChangeThis!123"])
    name: str = Field(min_length=1, max_length=160, examples=["Alex Lead"])


class LoginIn(BaseModel):
    email: str
    password: str


class WorkspaceIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    slug: str = Field(pattern=r"^[a-z0-9-]{2,100}$")
    description: str | None = None


class WorkspacePatch(BaseModel):
    name: str = Field(default=None, min_length=1, max_length=160)
    slug: str = Field(default=None, pattern=r"^[a-z0-9-]{2,100}$")
    description: str | None = None


class WorkspaceMemberAdd(BaseModel):
    email: EmailStr = Field(examples=["developer@example.com"])
    role: str = Field(default="member", pattern=r"^(admin|member|guest)$")


class WorkspaceMemberAccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160, examples=["Jamie Developer"])
    email: EmailStr = Field(examples=["developer@example.com"])
    password: str = Field(min_length=12, max_length=128)
    role: str = Field(default="member", pattern=r"^(admin|member|guest)$")


class TeamIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = None


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    key: str = Field(pattern=r"^[A-Z][A-Z0-9]{1,15}$")
    description: str | None = None
    team_id: str | None = None
    status: str = "planned"
    health: str = "green"


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    type: str = "task"
    priority: str = "medium"
    severity: str = Field(default="medium", pattern=r"^(critical|high|medium|low)$")
    status: str = "Todo"
    assignee_id: str | None = None
    due_at: datetime | None = None
    estimate_hours: float | None = Field(default=None, ge=0)


class TaskPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None
    type: str | None = None
    priority: str | None = None
    severity: str = Field(default="medium", pattern=r"^(critical|high|medium|low)$")
    status: str | None = None
    assignee_id: str | None = None
    due_at: datetime | None = None
    estimate_hours: float | None = Field(default=None, ge=0)
    handoff_done: str | None = Field(default=None, min_length=1, max_length=2000)
    handoff_needs: str | None = Field(default=None, min_length=1, max_length=2000)


class AIChatIn(BaseModel):
    workspace_id: str = Field(examples=["workspace-uuid"])
    question: str = Field(
        min_length=1, max_length=4000, examples=["What work is currently in progress?"]
    )
    project_id: str | None = Field(default=None, examples=["project-uuid"])


class AISourceOut(BaseModel):
    type: str
    id: str
    title: str
    key: str | None = None


class AIChatOut(BaseModel):
    answer: str
    sources: list[AISourceOut]


class ChannelCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80, examples=["design-review"])
    description: str | None = Field(default=None, max_length=500)
    is_private: bool = False


class ChannelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    workspace_id: str
    name: str
    slug: str
    description: str | None = None
    is_private: bool
    created_by: str
    created_at: datetime
    updated_at: datetime


class ChannelPatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=500)


class ChannelMemberAdd(BaseModel):
    user_id: str = Field(examples=["member-uuid"])


class ChannelMemberOut(BaseModel):
    id: str
    channel_id: str
    user_id: str
    name: str
    email: EmailStr
    role: str


class ChannelMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000, examples=["The new onboarding flow is ready for review."])
    parent_message_id: str | None = None


class ChannelMessagePatch(BaseModel):
    body: str = Field(min_length=1, max_length=10000)


class ChannelMessageOut(BaseModel):
    id: str
    channel_id: str
    user_id: str
    user_name: str
    parent_message_id: str | None = None
    body: str
    edited_at: datetime | None = None
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class WikiPageCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200, examples=["Engineering handbook"])
    content: str = Field(default="", max_length=100000)
    parent_page_id: str | None = None
    icon: str | None = Field(default=None, max_length=32)


class WikiPagePatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, max_length=100000)
    parent_page_id: str | None = None
    icon: str | None = Field(default=None, max_length=32)
    change_summary: str | None = Field(default=None, max_length=300)


class WikiPageSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    workspace_id: str
    parent_page_id: str | None = None
    title: str
    slug: str
    icon: str | None = None
    created_by: str
    updated_by: str | None = None
    created_at: datetime
    updated_at: datetime


class WikiPageOut(WikiPageSummary):
    content: str


class WikiVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    page_id: str
    version_number: int
    title: str
    content: str
    change_summary: str | None = None
    created_by: str
    created_at: datetime
