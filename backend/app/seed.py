import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.entities import (
    Project,
    Task,
    Team,
    TeamMember,
    User,
    WorkflowStatus,
    Workspace,
    WorkspaceMember,
)


async def seed():
    password = settings.demo_password
    if not password or len(password) < 12:
        raise RuntimeError("Set DEMO_PASSWORD to a value with at least 12 characters")
    lead_email = settings.demo_lead_email.strip().lower()
    if not lead_email:
        raise RuntimeError("Set DEMO_LEAD_EMAIL to the owner login email")
    async with SessionLocal() as db:
        existing = await db.scalar(select(Workspace).where(Workspace.slug == "demo-engineering"))
        if existing:
            print("Demo workspace already exists; no changes made")
            return
        people = []
        for email, name, role in [
            (lead_email, "Team Lead", "owner")
        ]:
            person = await db.scalar(select(User).where(User.email == email))
            if not person:
                person = User(
                    email=email, name=name, password_hash=hash_password(password), role=role
                )
                db.add(person)
                await db.flush()
            people.append(person)
        lead, *juniors = people
        workspace = Workspace(
            name="Demo Engineering",
            slug="demo-engineering",
            description="Sample team workspace",
            created_by=lead.id,
        )
        db.add(workspace)
        await db.flush()
        for person in people:
            db.add(
                WorkspaceMember(
                    workspace_id=workspace.id,
                    user_id=person.id,
                    role="owner" if person == lead else "member",
                    created_by=lead.id,
                )
            )
        team = Team(workspace_id=workspace.id, name="Product Engineering", created_by=lead.id)
        db.add(team)
        await db.flush()
        for person in people:
            db.add(
                TeamMember(
                    team_id=team.id,
                    user_id=person.id,
                    role="team_lead" if person == lead else "member",
                    created_by=lead.id,
                )
            )
        for name, key in [("Platform API", "PLAT"), ("Customer Portal", "PORT")]:
            project = Project(
                workspace_id=workspace.id,
                team_id=team.id,
                name=name,
                key=key,
                status="active",
                created_by=lead.id,
            )
            db.add(project)
            await db.flush()
            statuses = ["Backlog", "Todo", "In Progress", "In Review", "Done"]
            for idx, status in enumerate(statuses):
                category = (
                    "done"
                    if status == "Done"
                    else "in_progress"
                    if status in {"In Progress", "In Review"}
                    else "todo"
                )
                db.add(
                    WorkflowStatus(
                        project_id=project.id, name=status, category=category, position=idx
                    )
                )
            for idx, title in enumerate(
                ["Set up CI pipeline", "Add health endpoint", "Write API onboarding guide"]
            ):
                db.add(
                    Task(
                        project_id=project.id,
                        number=idx + 1,
                        title=title,
                        status=statuses[min(idx + 1, 4)],
                        priority="medium",
                        reporter_id=lead.id,
                        assignee_id=juniors[idx % len(juniors)].id if juniors else None,
                        created_by=lead.id,
                    )
                )
        await db.commit()
        print(
            f"Seeded demo-engineering workspace with {len(people)} users. All accounts share DEMO_PASSWORD."
        )


if __name__ == "__main__":
    asyncio.run(seed())
