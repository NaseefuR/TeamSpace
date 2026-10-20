import mimetypes
import re
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, require_workspace_role
from app.db.session import get_db
from app.models.entities import (
    Channel,
    ChannelMember,
    ChannelMessage,
    User,
    WikiPage,
    WikiVersion,
    WorkspaceFile,
    WorkspaceMember,
)
from app.core.config import settings
from app.schemas.common import (
    ChannelCreate,
    ChannelMemberAdd,
    ChannelMemberOut,
    ChannelMessageCreate,
    ChannelMessageOut,
    ChannelMessagePatch,
    ChannelOut,
    ChannelPatch,
    Envelope,
    WikiPageCreate,
    WikiPageOut,
    WikiPagePatch,
    WikiPageSummary,
    WikiVersionOut,
    WorkspaceFileOut,
)

router = APIRouter()
WORKSPACE_ROLES = {"owner", "admin", "member", "guest"}
EDITOR_ROLES = {"owner", "admin", "member"}
ALLOWED_DOCUMENT_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".odt", ".rtf", ".txt", ".md", ".csv",
    ".xls", ".xlsx", ".ods", ".ppt", ".pptx", ".odp",
}


def _workspace_file_path(storage_key: str) -> Path:
    return Path(settings.file_storage_path).resolve() / "workspace" / storage_key


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:220].strip("-") or "untitled"


async def _channel_access(channel_id: str, user: User, db: AsyncSession) -> tuple[Channel, str]:
    channel = await db.get(Channel, channel_id)
    if not channel or channel.deleted_at:
        raise HTTPException(404, "Channel not found")
    role = await require_workspace_role(channel.workspace_id, WORKSPACE_ROLES, user, db)
    if channel.is_private and role not in {"owner", "admin"}:
        membership = await db.scalar(
            select(ChannelMember.id).where(
                ChannelMember.channel_id == channel.id, ChannelMember.user_id == user.id
            )
        )
        if not membership:
            raise HTTPException(404, "Channel not found")
    return channel, role


async def _wiki_access(page_id: str, user: User, db: AsyncSession) -> tuple[WikiPage, str]:
    page = await db.get(WikiPage, page_id)
    if not page or page.deleted_at:
        raise HTTPException(404, "Document not found")
    role = await require_workspace_role(page.workspace_id, WORKSPACE_ROLES, user, db)
    return page, role


def _message_out(message: ChannelMessage, user_name: str) -> dict:
    return {
        "id": message.id,
        "channel_id": message.channel_id,
        "user_id": message.user_id,
        "user_name": user_name,
        "parent_message_id": message.parent_message_id,
        "body": "This message was deleted" if message.deleted_at else message.body,
        "edited_at": message.edited_at,
        "deleted_at": message.deleted_at,
        "created_at": message.created_at,
        "updated_at": message.updated_at,
    }


@router.get(
    "/workspaces/{workspace_id}/channels",
    response_model=Envelope[list[ChannelOut]],
    tags=["channels"],
    summary="List workspace channels",
    description="Lists public channels and private channels the caller can access.",
)
async def list_channels(
    workspace_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    role = await require_workspace_role(workspace_id, WORKSPACE_ROLES, user, db)
    query = select(Channel).where(Channel.workspace_id == workspace_id, Channel.deleted_at.is_(None))
    if role not in {"owner", "admin"}:
        private_membership = select(ChannelMember.id).where(
            ChannelMember.channel_id == Channel.id, ChannelMember.user_id == user.id
        )
        query = query.where((Channel.is_private.is_(False)) | private_membership.exists())
    result = await db.execute(query.order_by(Channel.is_private, Channel.name))
    return {"data": result.scalars().all()}


@router.post(
    "/workspaces/{workspace_id}/channels",
    response_model=Envelope[ChannelOut],
    status_code=201,
    tags=["channels"],
    summary="Create a channel",
    description="Creates a workspace channel. Members may create; guests can read existing channels.",
)
async def create_channel(
    workspace_id: str,
    body: ChannelCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_role(workspace_id, EDITOR_ROLES, user, db)
    channel = Channel(
        workspace_id=workspace_id,
        name=body.name.strip(),
        slug=_slug(body.name),
        description=body.description.strip() if body.description else None,
        is_private=body.is_private,
        created_by=user.id,
    )
    db.add(channel)
    await db.flush()
    if channel.is_private:
        db.add(ChannelMember(channel_id=channel.id, user_id=user.id, created_by=user.id))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "A channel with this name already exists")
    await db.refresh(channel)
    return {"data": channel}


@router.patch(
    "/channels/{channel_id}",
    response_model=Envelope[ChannelOut],
    tags=["channels"],
    summary="Update a channel",
    description="Channel creator and workspace owners/admins can edit its name and description.",
)
async def update_channel(
    channel_id: str,
    body: ChannelPatch,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    channel, role = await _channel_access(channel_id, user, db)
    if role not in {"owner", "admin"} and channel.created_by != user.id:
        raise HTTPException(403, "Only the channel creator or a workspace admin can edit it")
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "Provide at least one channel field to update")
    if "name" in changes:
        name = (changes["name"] or "").strip()
        if not name:
            raise HTTPException(422, "Channel name cannot be blank")
        channel.name = name
        channel.slug = _slug(name)
    if "description" in changes:
        channel.description = changes["description"].strip() if changes["description"] else None
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "A channel with this name already exists")
    await db.refresh(channel)
    return {"data": channel}


@router.delete(
    "/channels/{channel_id}",
    response_model=Envelope[dict],
    tags=["channels"],
    summary="Archive a channel",
    description="Soft deletes a channel. The creator or workspace owners/admins can archive it.",
)
async def delete_channel(
    channel_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    channel, role = await _channel_access(channel_id, user, db)
    if role not in {"owner", "admin"} and channel.created_by != user.id:
        raise HTTPException(403, "Only the channel creator or a workspace admin can archive it")
    channel.deleted_at = datetime.now(UTC)
    await db.commit()
    return {"data": {"id": channel.id, "archived": True}}


@router.post(
    "/channels/{channel_id}/members",
    response_model=Envelope[dict],
    status_code=201,
    tags=["channels"],
    summary="Add a member to a private channel",
    description="Only the channel creator or a workspace owner/admin can add workspace members.",
)
async def add_channel_member(
    channel_id: str,
    body: ChannelMemberAdd,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    channel, role = await _channel_access(channel_id, user, db)
    if not channel.is_private:
        raise HTTPException(409, "Public channels are available to all workspace members")
    if role not in {"owner", "admin"} and channel.created_by != user.id:
        raise HTTPException(403, "Only the channel creator or a workspace admin can add members")
    target = await db.scalar(
        select(WorkspaceMember)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(
            WorkspaceMember.workspace_id == channel.workspace_id,
            WorkspaceMember.user_id == body.user_id,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    )
    if not target:
        raise HTTPException(404, "Workspace member not found")
    if await db.scalar(
        select(ChannelMember.id).where(
            ChannelMember.channel_id == channel_id, ChannelMember.user_id == body.user_id
        )
    ):
        raise HTTPException(409, "User is already in this channel")
    membership = ChannelMember(channel_id=channel_id, user_id=body.user_id, created_by=user.id)
    db.add(membership)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "User is already in this channel")
    await db.refresh(membership)
    return {"data": {"id": membership.id, "channel_id": channel_id, "user_id": body.user_id}}


@router.get(
    "/channels/{channel_id}/members",
    response_model=Envelope[list[ChannelMemberOut]],
    tags=["channels"],
    summary="List channel members",
    description="Lists private-channel members or all workspace members for a public channel.",
)
async def list_channel_members(
    channel_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    channel, _ = await _channel_access(channel_id, user, db)
    query = (
        select(WorkspaceMember, User)
        .join(User, WorkspaceMember.user_id == User.id)
        .where(
            WorkspaceMember.workspace_id == channel.workspace_id,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
        .order_by(User.name)
    )
    if channel.is_private:
        query = query.join(
            ChannelMember,
            (ChannelMember.user_id == WorkspaceMember.user_id)
            & (ChannelMember.channel_id == channel.id),
        )
    result = await db.execute(query)
    return {
        "data": [
            {
                "id": membership.id,
                "channel_id": channel.id,
                "user_id": member.id,
                "name": member.name,
                "email": member.email,
                "role": membership.role,
            }
            for membership, member in result.all()
        ]
    }


@router.delete(
    "/channels/{channel_id}/members/{member_user_id}",
    response_model=Envelope[dict],
    tags=["channels"],
    summary="Remove a member from a private channel",
    description="The channel creator or workspace owner/admin can remove a private-channel member.",
)
async def remove_channel_member(
    channel_id: str,
    member_user_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    channel, role = await _channel_access(channel_id, user, db)
    if not channel.is_private:
        raise HTTPException(409, "Public channels are available to all workspace members")
    if role not in {"owner", "admin"} and channel.created_by != user.id:
        raise HTTPException(403, "Only the channel creator or a workspace admin can remove members")
    if member_user_id == channel.created_by:
        raise HTTPException(409, "The channel creator cannot be removed")
    membership = await db.scalar(
        select(ChannelMember).where(
            ChannelMember.channel_id == channel.id, ChannelMember.user_id == member_user_id
        )
    )
    if not membership:
        raise HTTPException(404, "Channel member not found")
    await db.delete(membership)
    await db.commit()
    return {"data": {"channel_id": channel.id, "user_id": member_user_id, "removed": True}}


@router.get(
    "/channels/{channel_id}/messages",
    response_model=Envelope[list[ChannelMessageOut]],
    tags=["channels"],
    summary="List channel messages",
    description="Returns chronological messages or replies for a root message, with pagination.",
)
async def list_channel_messages(
    channel_id: str,
    parent_message_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    await _channel_access(channel_id, user, db)
    if parent_message_id:
        parent = await db.get(ChannelMessage, parent_message_id)
        if not parent or parent.channel_id != channel_id or parent.parent_message_id:
            raise HTTPException(404, "Thread not found")
    query = (
        select(ChannelMessage, User.name)
        .join(User, User.id == ChannelMessage.user_id)
        .where(
            ChannelMessage.channel_id == channel_id,
            ChannelMessage.parent_message_id == parent_message_id,
        )
        .order_by(ChannelMessage.created_at)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    total = await db.scalar(
        select(func.count()).select_from(ChannelMessage).where(
            ChannelMessage.channel_id == channel_id,
            ChannelMessage.parent_message_id == parent_message_id,
        )
    )
    return {
        "data": [_message_out(message, name) for message, name in result.all()],
        "meta": {"page": page, "page_size": page_size, "total": total or 0},
    }


@router.post(
    "/channels/{channel_id}/messages",
    response_model=Envelope[ChannelMessageOut],
    status_code=201,
    tags=["channels"],
    summary="Post a channel message",
    description="Creates a message or a one-level threaded reply.",
)
async def create_channel_message(
    channel_id: str,
    body: ChannelMessageCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    channel, _ = await _channel_access(channel_id, user, db)
    text = body.body.strip()
    if not text:
        raise HTTPException(422, "Message cannot be blank")
    if body.parent_message_id:
        parent = await db.get(ChannelMessage, body.parent_message_id)
        if not parent or parent.channel_id != channel.id or parent.parent_message_id:
            raise HTTPException(404, "Thread not found")
    message = ChannelMessage(
        channel_id=channel.id,
        user_id=user.id,
        parent_message_id=body.parent_message_id,
        body=text,
        created_by=user.id,
    )
    db.add(message)
    await db.flush()
    await db.commit()
    await db.refresh(message)
    return {"data": _message_out(message, user.name)}


@router.patch(
    "/channels/{channel_id}/messages/{message_id}",
    response_model=Envelope[ChannelMessageOut],
    tags=["channels"],
    summary="Edit a channel message",
    description="The author or a workspace owner/admin can edit a message.",
)
async def update_channel_message(
    channel_id: str,
    message_id: str,
    body: ChannelMessagePatch,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    channel, role = await _channel_access(channel_id, user, db)
    message = await db.get(ChannelMessage, message_id)
    if not message or message.channel_id != channel.id or message.deleted_at:
        raise HTTPException(404, "Message not found")
    if message.user_id != user.id and role not in {"owner", "admin"}:
        raise HTTPException(403, "Only the author or a workspace admin can edit this message")
    text = body.body.strip()
    if not text:
        raise HTTPException(422, "Message cannot be blank")
    message.body = text
    message.edited_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(message)
    return {"data": _message_out(message, user.name if message.user_id == user.id else await db.scalar(select(User.name).where(User.id == message.user_id)))}


@router.delete(
    "/channels/{channel_id}/messages/{message_id}",
    response_model=Envelope[dict],
    tags=["channels"],
    summary="Delete a channel message",
    description="Soft deletes a message. The author or workspace owner/admin can delete it.",
)
async def delete_channel_message(
    channel_id: str,
    message_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    channel, role = await _channel_access(channel_id, user, db)
    message = await db.get(ChannelMessage, message_id)
    if not message or message.channel_id != channel.id or message.deleted_at:
        raise HTTPException(404, "Message not found")
    if message.user_id != user.id and role not in {"owner", "admin"}:
        raise HTTPException(403, "Only the author or a workspace admin can delete this message")
    message.deleted_at = datetime.now(UTC)
    await db.commit()
    return {"data": {"id": message.id, "deleted": True}}


@router.get(
    "/workspaces/{workspace_id}/docs",
    response_model=Envelope[list[WikiPageSummary]],
    tags=["docs"],
    summary="List workspace documents",
    description="Lists active Markdown documents in the workspace.",
)
async def list_docs(
    workspace_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=100),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_role(workspace_id, WORKSPACE_ROLES, user, db)
    query = (
        select(WikiPage)
        .where(WikiPage.workspace_id == workspace_id, WikiPage.deleted_at.is_(None))
        .order_by(WikiPage.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    total = await db.scalar(
        select(func.count()).select_from(WikiPage).where(
            WikiPage.workspace_id == workspace_id, WikiPage.deleted_at.is_(None)
        )
    )
    return {
        "data": result.scalars().all(),
        "meta": {"page": page, "page_size": page_size, "total": total or 0},
    }


@router.get(
    "/workspaces/{workspace_id}/files",
    response_model=Envelope[list[WorkspaceFileOut]],
    tags=["docs"],
    summary="List workspace files",
)
async def list_workspace_files(
    workspace_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_role(workspace_id, WORKSPACE_ROLES, user, db)
    result = await db.execute(
        select(WorkspaceFile)
        .where(WorkspaceFile.workspace_id == workspace_id, WorkspaceFile.deleted_at.is_(None))
        .order_by(WorkspaceFile.created_at.desc())
    )
    return {"data": result.scalars().all()}


@router.post(
    "/workspaces/{workspace_id}/files",
    response_model=Envelope[WorkspaceFileOut],
    status_code=201,
    tags=["docs"],
    summary="Upload a file to a workspace",
)
async def upload_workspace_file(
    workspace_id: str,
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_role(workspace_id, EDITOR_ROLES, user, db)
    filename = (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1].strip()
    extension = Path(filename).suffix.lower()
    if not filename or len(filename) > 255:
        raise HTTPException(422, "File name must be between 1 and 255 characters")
    if extension not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise HTTPException(415, "This file type is not supported")

    storage_key = f"{uuid.uuid4()}{extension}"
    destination = _workspace_file_path(storage_key)
    destination.parent.mkdir(parents=True, exist_ok=True)
    size_bytes = 0
    try:
        with destination.open("wb") as stored:
            while chunk := await file.read(1024 * 1024):
                size_bytes += len(chunk)
                if size_bytes > settings.max_upload_bytes:
                    raise HTTPException(413, "File exceeds the upload size limit")
                stored.write(chunk)
        if size_bytes == 0:
            raise HTTPException(422, "The uploaded file is empty")
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        record = WorkspaceFile(
            workspace_id=workspace_id,
            filename=filename,
            storage_key=storage_key,
            content_type=content_type,
            size_bytes=size_bytes,
            uploaded_by=user.id,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return {"data": record}
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await file.close()


@router.get(
    "/workspace-files/{file_id}/download",
    tags=["docs"],
    summary="Download a workspace file",
)
async def download_workspace_file(
    file_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await db.get(WorkspaceFile, file_id)
    if not record or record.deleted_at:
        raise HTTPException(404, "File not found")
    await require_workspace_role(record.workspace_id, WORKSPACE_ROLES, user, db)
    path = _workspace_file_path(record.storage_key)
    if not path.is_file():
        raise HTTPException(404, "File content is unavailable")
    return FileResponse(path, media_type=record.content_type, filename=record.filename)


@router.delete(
    "/workspace-files/{file_id}",
    response_model=Envelope[dict],
    tags=["docs"],
    summary="Remove a workspace file",
)
async def delete_workspace_file(
    file_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await db.get(WorkspaceFile, file_id)
    if not record or record.deleted_at:
        raise HTTPException(404, "File not found")
    role = await require_workspace_role(record.workspace_id, WORKSPACE_ROLES, user, db)
    if record.uploaded_by != user.id and role not in {"owner", "admin"}:
        raise HTTPException(403, "Only the uploader or a workspace admin can remove this file")
    record.deleted_at = datetime.now(UTC)
    await db.commit()
    return {"data": {"id": record.id, "deleted": True}}


@router.post(
    "/workspaces/{workspace_id}/docs",
    response_model=Envelope[WikiPageOut],
    status_code=201,
    tags=["docs"],
    summary="Create a workspace document",
    description="Creates a Markdown document and its initial version; members can create documents.",
)
async def create_doc(
    workspace_id: str,
    body: WikiPageCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_role(workspace_id, EDITOR_ROLES, user, db)
    title = body.title.strip()
    if not title:
        raise HTTPException(422, "Document title cannot be blank")
    if body.parent_page_id:
        parent = await db.get(WikiPage, body.parent_page_id)
        if not parent or parent.deleted_at or parent.workspace_id != workspace_id:
            raise HTTPException(404, "Parent document not found in this workspace")
    page = WikiPage(
        workspace_id=workspace_id,
        parent_page_id=body.parent_page_id,
        title=title,
        slug=_slug(title),
        content=body.content,
        icon=body.icon,
        created_by=user.id,
        updated_by=user.id,
    )
    db.add(page)
    await db.flush()
    db.add(
        WikiVersion(
            page_id=page.id,
            version_number=1,
            title=page.title,
            content=page.content,
            change_summary="Created document",
            created_by=user.id,
        )
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "A document with this title already exists")
    await db.refresh(page)
    return {"data": page}


@router.get(
    "/docs/{page_id}",
    response_model=Envelope[WikiPageOut],
    tags=["docs"],
    summary="Get a document",
    description="Returns Markdown content for a document visible in the caller's workspace.",
)
async def get_doc(
    page_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    page, _ = await _wiki_access(page_id, user, db)
    return {"data": page}


@router.patch(
    "/docs/{page_id}",
    response_model=Envelope[WikiPageOut],
    tags=["docs"],
    summary="Update a document",
    description="Saves document content as a new immutable version.",
)
async def update_doc(
    page_id: str,
    body: WikiPagePatch,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    page, role = await _wiki_access(page_id, user, db)
    if role not in EDITOR_ROLES:
        raise HTTPException(403, "Workspace guests cannot edit documents")
    changes = body.model_dump(exclude_unset=True)
    summary = changes.pop("change_summary", None)
    if not changes:
        raise HTTPException(422, "Provide at least one document field to update")
    if "parent_page_id" in changes and changes["parent_page_id"]:
        parent = await db.get(WikiPage, changes["parent_page_id"])
        if not parent or parent.deleted_at or parent.workspace_id != page.workspace_id:
            raise HTTPException(404, "Parent document not found in this workspace")
        if parent.id == page.id:
            raise HTTPException(422, "A document cannot be its own parent")
        ancestor_id = parent.parent_page_id
        seen_ancestors = {parent.id}
        while ancestor_id:
            if ancestor_id == page.id or ancestor_id in seen_ancestors:
                raise HTTPException(422, "Document hierarchy cannot contain a cycle")
            seen_ancestors.add(ancestor_id)
            ancestor = await db.get(WikiPage, ancestor_id)
            if not ancestor or ancestor.deleted_at or ancestor.workspace_id != page.workspace_id:
                break
            ancestor_id = ancestor.parent_page_id
    for key, value in changes.items():
        if key == "title" and value is not None:
            value = value.strip()
            if not value:
                raise HTTPException(422, "Document title cannot be blank")
            page.slug = _slug(value)
        if key in {"title", "content"} and value is None:
            raise HTTPException(422, f"Document {key} cannot be null")
        setattr(page, key, value)
    page.updated_by = user.id
    version_number = (await db.scalar(
        select(func.max(WikiVersion.version_number)).where(WikiVersion.page_id == page.id)
    ) or 0) + 1
    db.add(
        WikiVersion(
            page_id=page.id,
            version_number=version_number,
            title=page.title,
            content=page.content,
            change_summary=summary,
            created_by=user.id,
        )
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "A document with this title already exists")
    await db.refresh(page)
    return {"data": page}


@router.delete(
    "/docs/{page_id}",
    response_model=Envelope[dict],
    tags=["docs"],
    summary="Archive a document",
    description="Soft deletes a document. The author or workspace owner/admin can archive it.",
)
async def delete_doc(
    page_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    page, role = await _wiki_access(page_id, user, db)
    if role not in {"owner", "admin"} and page.created_by != user.id:
        raise HTTPException(403, "Only the document author or a workspace admin can archive it")
    page.deleted_at = datetime.now(UTC)
    await db.commit()
    return {"data": {"id": page.id, "archived": True}}


@router.get(
    "/docs/{page_id}/versions",
    response_model=Envelope[list[WikiVersionOut]],
    tags=["docs"],
    summary="List document versions",
    description="Returns saved snapshots newest first.",
)
async def list_doc_versions(
    page_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    await _wiki_access(page_id, user, db)
    result = await db.execute(
        select(WikiVersion)
        .where(WikiVersion.page_id == page_id)
        .order_by(WikiVersion.version_number.desc())
    )
    return {"data": result.scalars().all()}
