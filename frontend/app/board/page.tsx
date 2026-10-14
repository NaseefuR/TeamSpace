"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  ArrowDownUp,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  CircleDashed,
  CornerDownRight,
  Clock3,
  Filter,
  GripVertical,
  History,
  KanbanSquare,
  Layers3,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { api, taskKey } from "@/lib/api";
import type { Project, Task, TaskUpdate, WorkspaceMember } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { useWorkspace } from "@/store/workspace";

const columns = ["Backlog", "Todo", "In Progress", "In Review", "Done"];
const laneStyles: Record<string, { dot: string; wash: string; count: string; icon: typeof CircleDashed }> = {
  Backlog: { dot: "lane-dot-muted", wash: "lane-wash-muted", count: "lane-count-muted", icon: CircleDashed },
  Todo: { dot: "lane-dot-blue", wash: "lane-wash-blue", count: "lane-count-blue", icon: Filter },
  "In Progress": { dot: "lane-dot-violet", wash: "lane-wash-violet", count: "lane-count-violet", icon: Clock3 },
  "In Review": { dot: "lane-dot-amber", wash: "lane-wash-amber", count: "lane-count-amber", icon: Search },
  Done: { dot: "lane-dot-green", wash: "lane-wash-green", count: "lane-count-green", icon: CheckCircle2 },
};

const initials = (name?: string) => name?.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
const readableDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const readableDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

function Card({
  task,
  project,
  members,
  canEdit,
  canDelete,
  canMove,
  onAssign,
  onEdit,
  onDelete,
  onHistory,
}: {
  task: Task;
  project?: Project;
  members: WorkspaceMember[];
  canEdit: boolean;
  canDelete: boolean;
  canMove: boolean;
  onAssign: (taskId: string, assigneeId: string | null) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onHistory: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: !canMove });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.42 : 1, zIndex: isDragging ? 10 : undefined };
  const assigned = members.find(member => member.user_id === task.assignee_id);
  const dueDate = readableDate(task.due_at);
  const createdDateTime = readableDateTime(task.created_at);
  const overdue = !!task.due_at && new Date(task.due_at).getTime() < Date.now() && task.status !== "Done";

  return <article ref={setNodeRef} style={style} className={`board-task group relative rounded-[17px] p-3.5 transition duration-300 ${isDragging ? "board-task-dragging" : ""}`}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="board-task-key truncate">{project ? taskKey(project, task) : `#${task.number}`}</span>
        {!project && <span className="board-project-chip max-w-[104px] truncate">Task</span>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canDelete && <button type="button" onClick={() => onDelete(task)} aria-label={`Delete ${task.title}`} title="Delete task" className="board-icon-button text-red-300/70 hover:text-red-300"><Trash2 size={13}/></button>}
        {canEdit && <button type="button" onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`} className="board-icon-button opacity-0 transition group-hover:opacity-100 focus:opacity-100"><Pencil size={13}/></button>}
        <button type="button" onClick={() => onHistory(task)} aria-label={`View status history for ${task.title}`} title="View handoff history" className="board-icon-button"><History size={13}/></button>
        {canMove && <button type="button" {...listeners} {...attributes} aria-label={`Drag ${task.title}`} title="Drag to change status" className="board-icon-button cursor-grab touch-none text-white/35 active:cursor-grabbing"><GripVertical size={15}/></button>}
      </div>
    </div>

    <h3 className="mt-3 line-clamp-2 text-[13px] font-semibold leading-[1.45] tracking-[-.015em]">{task.title}</h3>

    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className={`board-priority board-priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
      {dueDate && <span className={`board-due ${overdue ? "board-due-overdue" : ""}`}><CalendarDays size={10}/>{dueDate}</span>}
    </div>
    {createdDateTime && <div className="board-created" title={`Created ${createdDateTime}`}><Clock3 size={10}/><span>Created {createdDateTime}</span></div>}

    <div className="mt-3.5 flex min-h-8 items-center justify-between gap-2 border-t border-white/[.07] pt-2.5">
      {canEdit ? <label className="board-assignee-wrap min-w-0 flex-1" title="Change assignee">
        <span className={`board-avatar ${assigned ? "" : "board-avatar-empty"}`}>{assigned ? initials(assigned.name) : <UserRound size={12}/>}</span>
        <select aria-label={`Assignee for ${task.title}`} value={task.assignee_id ?? ""} onChange={event => onAssign(task.id, event.target.value || null)} className="board-assignee-select">
          <option value="">Unassigned</option>
          {members.map(member => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}
        </select>
      </label> : <span className="flex min-w-0 items-center gap-2 text-[10px] text-white/48"><span className={`board-avatar ${assigned ? "" : "board-avatar-empty"}`}>{assigned ? initials(assigned.name) : <UserRound size={12}/>}</span><span className="truncate">{assigned?.name ?? "Unassigned"}</span></span>}
      {canMove && <span className="board-drag-label">Move</span>}
    </div>
  </article>;
}

function Column({
  name,
  tasks,
  projects,
  members,
  canEdit,
  canDelete,
  canMoveTask,
  onAssign,
  onAdd,
  onEdit,
  onDelete,
  onHistory,
}: {
  name: string;
  tasks: Task[];
  projects: Record<string, Project>;
  members: WorkspaceMember[];
  canEdit: boolean;
  canDelete: boolean;
  canMoveTask: (task: Task) => boolean;
  onAssign: (taskId: string, assigneeId: string | null) => void;
  onAdd: (status: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onHistory: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: name });
  const config = laneStyles[name] ?? laneStyles.Backlog;
  const Icon = config.icon;
  return <section ref={setNodeRef} aria-label={`${name}: ${tasks.length} tasks`} className={`board-lane bento-enter ${isOver ? "board-lane-over" : ""}`}>
    <header className="board-lane-header">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`board-lane-icon ${config.wash}`}><Icon size={13}/></span>
        <h2 className="truncate text-[11px] font-bold tracking-[.015em]">{name}</h2>
        <span className={`board-lane-count ${config.count}`}>{tasks.length}</span>
      </div>
      {canEdit && <button type="button" onClick={() => onAdd(name)} aria-label={`Add task to ${name}`} title={`Add to ${name}`} className="board-icon-button"><Plus size={15}/></button>}
    </header>
    <div className={`board-lane-accent ${config.dot}`}/>
    <div className="board-lane-list">
      {tasks.length ? tasks.map(task => <Card key={task.id} task={task} project={projects[task.project_id]} members={members} canEdit={canEdit} canDelete={canDelete} canMove={canMoveTask(task)} onAssign={onAssign} onEdit={onEdit} onDelete={onDelete} onHistory={onHistory}/>) : <div className={`board-empty ${isOver ? "board-empty-over" : ""}`}><span className="board-empty-mark"><Plus size={15}/></span><span>{isOver ? "Release to move here" : "Drop a task here"}</span></div>}
    </div>
    {canEdit && <button type="button" onClick={() => onAdd(name)} className="board-add-inline"><Plus size={13}/>Add task</button>}
  </section>;
}

function BoardContent() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useAuth(state => state.user);
  const workspaceId = useWorkspace(state => state.selectedId);
  const client = useQueryClient();
  const [isMounted, setIsMounted] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [moveDialog, setMoveDialog] = useState<{ task: Task; status: string } | null>(null);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [initialStatus, setInitialStatus] = useState("Todo");
  const [priority, setPriority] = useState("medium");
  const [handoffDone, setHandoffDone] = useState("");
  const [handoffNeeds, setHandoffNeeds] = useState("");
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  useEffect(() => { if (!useAuth.getState().tokens) router.replace("/login"); }, [router]);
  useEffect(() => { setIsMounted(true); }, []);

  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces, enabled: !!user });
  const selectedWorkspace = workspaces.data?.find(workspace => workspace.id === workspaceId) ?? workspaces.data?.[0];
  const allProjects = useQuery({ queryKey: ["projects", selectedWorkspace?.id], queryFn: () => api.projects(selectedWorkspace!.id), enabled: !!selectedWorkspace });
  const membersQuery = useQuery({ queryKey: ["members", selectedWorkspace?.id], queryFn: () => api.members(selectedWorkspace!.id), enabled: !!selectedWorkspace });
  const selected = params.get("project");
  const projects = (allProjects.data ?? []).filter(project => !selected || project.id === selected);
  const queries = useQueries({ queries: projects.map(project => ({ queryKey: ["tasks", project.id], queryFn: () => api.tasks(project.id) })) });
  const tasks = useMemo(() => queries.flatMap(query => query.data ?? []), [queries]);
  const lookup = useMemo(() => Object.fromEntries((allProjects.data ?? []).map(project => [project.id, project])), [allProjects.data]);
  const members = membersQuery.data ?? [];
  const workspaceRole = membersQuery.data?.find(member => member.user_id === user?.id)?.role;
  const canEdit = workspaceRole === "owner" || workspaceRole === "admin";
  const canDelete = workspaceRole === "owner" || workspaceRole === "admin";
  const canMoveTask = (task: Task) => workspaceRole === "owner" || workspaceRole === "admin" || (workspaceRole === "member" && task.assignee_id === user?.id);
  const filteredTasks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tasks.filter(task => {
      const project = lookup[task.project_id];
      const matchesSearch = !needle || [task.title, project ? taskKey(project, task) : `#${task.number}`, project?.name, project?.key, task.priority].some(value => value?.toLowerCase().includes(needle));
      return matchesSearch && (!mineOnly || task.assignee_id === user?.id);
    });
  }, [tasks, search, mineOnly, user?.id, lookup]);
  const doneCount = filteredTasks.filter(task => task.status === "Done").length;
  const activeCount = filteredTasks.filter(task => task.status === "In Progress" || task.status === "In Review").length;
  const overdueCount = filteredTasks.filter(task => !!task.due_at && new Date(task.due_at).getTime() < Date.now() && task.status !== "Done").length;
  const loading = allProjects.isLoading || queries.some(query => query.isLoading);

  const statusHistory = useQuery({
    queryKey: ["task-status-history", historyTask?.id],
    queryFn: () => api.taskStatusHistory(historyTask!.id),
    enabled: !!historyTask,
  });

  const move = useMutation({
    mutationFn: ({ id, status, handoff_done, handoff_needs }: { id: string; status: string; handoff_done: string; handoff_needs: string }) =>
      api.updateTask(id, { status, handoff_done, handoff_needs }),
    onMutate: async ({ id, status }) => {
      await client.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = client.getQueriesData<Task[]>({ queryKey: ["tasks"] });
      snapshots.forEach(([key, data]) => client.setQueryData<Task[]>(key, data?.map(task => task.id === id ? { ...task, status } : task)));
      return { snapshots };
    },
    onError: (_error, _value, context) => context?.snapshots.forEach(([key, data]) => client.setQueryData(key, data)),
    onSuccess: () => {
      if (moveDialog) client.invalidateQueries({ queryKey: ["task-status-history", moveDialog.task.id] });
      setMoveDialog(null);
      setHandoffDone("");
      setHandoffNeeds("");
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: (task: Task) => api.deleteTask(task.id),
    onMutate: async task => {
      await client.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = client.getQueriesData<Task[]>({ queryKey: ["tasks"] });
      snapshots.forEach(([key, data]) => client.setQueryData<Task[]>(key, data?.filter(item => item.id !== task.id)));
      return { snapshots };
    },
    onError: (_error, _task, context) => context?.snapshots.forEach(([key, data]) => client.setQueryData(key, data)),
    onSuccess: () => setTaskToDelete(null),
    onSettled: () => client.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const assign = useMutation({
    mutationFn: ({ id, assignee_id }: { id: string; assignee_id: string | null }) => api.updateTask(id, { assignee_id }),
    onMutate: async ({ id, assignee_id }) => {
      await client.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = client.getQueriesData<Task[]>({ queryKey: ["tasks"] });
      snapshots.forEach(([key, data]) => client.setQueryData<Task[]>(key, data?.map(task => task.id === id ? { ...task, assignee_id } : task)));
      return { snapshots };
    },
    onError: (_error, _value, context) => context?.snapshots.forEach(([key, data]) => client.setQueryData(key, data)),
    onSettled: () => client.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const saveTask = useMutation({
    mutationFn: () => {
      if (!editingTask) return api.createTask(projectId, { title: title.trim(), assignee_id: assigneeId || null, status: initialStatus, priority });
      const changes: TaskUpdate = { title: title.trim(), assignee_id: assigneeId || null, priority };
      if (canMoveTask(editingTask)) {
        changes.status = initialStatus;
        if (initialStatus !== editingTask.status) {
          changes.handoff_done = handoffDone.trim();
          changes.handoff_needs = handoffNeeds.trim();
        }
      }
      return api.updateTask(editingTask.id, changes);
    },
    onSuccess: task => {
      client.invalidateQueries({ queryKey: ["tasks"] });
      client.invalidateQueries({ queryKey: ["task-status-history", task.id] });
      setDialog(false); setEditingTask(null); setTitle(""); setAssigneeId(""); setFormError(""); setHandoffDone(""); setHandoffNeeds("");
      if (selected && selected !== task.project_id) router.push(`/board?project=${task.project_id}`);
    },
    onError: error => setFormError(error.message),
  });

  function openCreate(status = "Todo") {
    setEditingTask(null); setInitialStatus(status); setProjectId(selected ?? allProjects.data?.[0]?.id ?? ""); setAssigneeId(""); setTitle(""); setPriority("medium"); setFormError(""); setHandoffDone(""); setHandoffNeeds(""); saveTask.reset(); setDialog(true);
  }
  function openEdit(task: Task) {
    setEditingTask(task); setInitialStatus(task.status); setProjectId(task.project_id); setAssigneeId(task.assignee_id ?? ""); setTitle(task.title); setPriority(task.priority); setFormError(""); setHandoffDone(""); setHandoffNeeds(""); saveTask.reset(); setDialog(true);
  }
  function onDragEnd(event: DragEndEvent) {
    if (!event.over) return;
    const task = tasks.find(item => item.id === String(event.active.id));
    const status = String(event.over.id);
    if (task && canMoveTask(task) && columns.includes(status) && task.status !== status) {
      move.reset();
      setMoveDialog({ task, status });
      setHandoffDone("");
      setHandoffNeeds("");
    }
  }
  function submitMove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!moveDialog) return;
    if (!handoffDone.trim() || !handoffNeeds.trim()) return;
    move.mutate({
      id: moveDialog.task.id,
      status: moveDialog.status,
      handoff_done: handoffDone.trim(),
      handoff_needs: handoffNeeds.trim(),
    });
  }

  if (!isMounted) return <div className="min-h-screen animate-pulse bg-[#10111a]"/>;

  return <>
    <div className="board-page">
      <section className="board-hero bento-enter">
        <div className="board-hero-grid" aria-hidden="true"/>
        <div className="board-hero-orbit board-hero-orbit-one" aria-hidden="true"/>
        <div className="board-hero-orbit board-hero-orbit-two" aria-hidden="true"/>
        <div className="board-hero-copy">
          <div className="board-eyebrow"><span className="board-eyebrow-mark"><KanbanSquare size={13}/></span> TEAM OPERATIONS <span className="board-eyebrow-line"/> LIVE WORKFLOW</div>
          <h1>Team board<span className="board-title-period">.</span></h1>
          <p>See the flow, find the friction, move the work forward.</p>
          <div className="board-hero-context"><span className="board-live-dot"/>{selectedWorkspace?.name ?? "Your workspace"}<span className="board-context-sep">/</span>{selected ? lookup[selected]?.name ?? "Project" : "All projects"}</div>
        </div>
        <div className="board-hero-stats">
          <div className="board-stat board-stat-total"><span className="board-stat-label"><Layers3 size={12}/> VISIBLE TASKS</span><strong>{loading ? "—" : filteredTasks.length.toString().padStart(2, "0")}</strong><span className="board-stat-foot">across this view</span></div>
          <div className="board-stat"><span className="board-stat-label"><Clock3 size={12}/> IN MOTION</span><strong>{loading ? "—" : activeCount.toString().padStart(2, "0")}</strong><span className="board-stat-foot">working or in review</span></div>
          <div className="board-stat"><span className="board-stat-label"><CheckCircle2 size={12}/> COMPLETED</span><strong>{loading ? "—" : doneCount.toString().padStart(2, "0")}</strong><span className="board-stat-foot">in the current view</span></div>
        </div>
        <div className="board-hero-corner"><Sparkles size={16}/></div>
      </section>

      <section className="board-toolbar bento-enter" aria-label="Board controls">
        <div className="board-toolbar-main">
          <div className="board-toolbar-heading"><span className="board-toolbar-icon"><ArrowDownUp size={15}/></span><div><h2>Workflow</h2><p>Filter and focus your team’s work</p></div></div>
          <div className="board-toolbar-controls">
            <label className="board-project-control"><span>PROJECT</span><select aria-label="Filter by project" value={selected ?? "all"} onChange={event => router.push(event.target.value === "all" ? "/board" : `/board?project=${event.target.value}`)}><option value="all">All projects</option>{(allProjects.data ?? []).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label className="board-search"><Search size={15}/><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a task…" aria-label="Search tasks"/>{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={13}/></button>}</label>
            <button type="button" onClick={() => setMineOnly(value => !value)} aria-pressed={mineOnly} className={`board-filter-button ${mineOnly ? "board-filter-active" : ""}`}><UserRound size={14}/>{mineOnly ? "My tasks" : "Assigned to me"}{mineOnly && <Check size={12}/>}</button>
            {canEdit && <button type="button" onClick={() => openCreate()} disabled={!allProjects.data?.length} className="board-create-button"><Plus size={15}/>New task</button>}
          </div>
        </div>
        <div className="board-toolbar-bottom">
          <div className="board-lane-legend"><span className="board-legend-item"><i className="lane-dot-violet"/>Active flow</span><span className="board-legend-item"><i className="lane-dot-green"/>Complete</span>{overdueCount > 0 && <span className="board-overdue-summary"><AlertCircle size={12}/>{overdueCount} overdue</span>}</div>
          <span className="board-task-summary">Showing <strong>{filteredTasks.length}</strong> of {tasks.length} tasks</span>
        </div>
      </section>

      {allProjects.isLoading || loading ? <div className="board-loading" aria-label="Loading board">{columns.map((column, index) => <div className="board-skeleton-lane" key={column} style={{ animationDelay: `${index * 70}ms` }}><div className="board-skeleton-line"/><div className="board-skeleton-card"/><div className="board-skeleton-card short"/></div>)}</div>
        : allProjects.error ? <div role="alert" className="board-error"><AlertCircle size={16}/>{allProjects.error.message}</div>
        : !allProjects.data?.length ? <div className="board-empty-state"><span className="board-empty-state-icon"><Layers3 size={22}/></span><h2>Your board is ready for a project</h2><p>Create a project, then start adding work to your team’s flow.</p></div>
        : <>
          <div className="board-permission-note"><span className="board-permission-icon"><GripVertical size={14}/></span><p>{workspaceRole === "member" ? "Drag your assigned tasks between columns to update their status. You can’t edit task details or reassign work." : "Drag tasks between columns to update their status. Use the card menu to edit details and ownership."}</p><span className="board-permission-short">DRAG TO UPDATE STATUS</span></div>
          {filteredTasks.length === 0 && search ? <div className="board-no-results"><Search size={18}/><strong>No tasks match “{search}”</strong><span>Try another task name, project key, or priority.</span><button type="button" onClick={() => setSearch("")}>Clear search</button></div> : null}
          <DndContext onDragEnd={onDragEnd}><div className="board-lanes" aria-label="Task columns">{columns.map(name => <Column key={name} name={name} tasks={filteredTasks.filter(task => task.status === name)} projects={lookup} members={members} canEdit={canEdit} canDelete={canDelete} canMoveTask={canMoveTask} onAssign={(id, assignee_id) => assign.mutate({ id, assignee_id })} onAdd={openCreate} onEdit={openEdit} onDelete={task => { deleteTask.reset(); setTaskToDelete(task); }} onHistory={setHistoryTask}/>)}</div></DndContext>
        </>}

      {(move.isError || assign.isError || deleteTask.isError) && <p role="alert" className="board-mutation-error"><AlertCircle size={14}/>{(move.error ?? assign.error ?? deleteTask.error)?.message}</p>}

      {dialog && <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setDialog(false); }}>
        <form onSubmit={event => { event.preventDefault(); if (!projectId) { setFormError("Choose a project first."); return; } if (editingTask && initialStatus !== editingTask.status && (!handoffDone.trim() || !handoffNeeds.trim())) { setFormError("Describe what has been done and what is needed next before changing status."); return; } saveTask.mutate(); }} className="board-task-dialog my-6 w-full max-w-lg rounded-[25px] p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><span className="board-dialog-icon"><KanbanSquare size={17}/></span><h2 className="mt-4 text-[20px] font-semibold tracking-[-.03em]">{editingTask ? "Shape this task" : "Create a task"}</h2><p className="mt-1 text-[12px] text-white/45">Set the details that help your team move with clarity.</p></div><button type="button" onClick={() => setDialog(false)} aria-label="Close dialog" className="board-icon-button"><X size={16}/></button></div>
          <label className="board-form-label mt-5 block">TASK TITLE<input autoFocus value={title} onChange={event => setTitle(event.target.value)} required maxLength={300} className="board-form-input mt-2" placeholder="Implement account settings"/></label>
          <label className="board-form-label mt-4 block">PROJECT<select disabled={!!editingTask} value={projectId} onChange={event => setProjectId(event.target.value)} className="board-form-input mt-2">{(allProjects.data ?? []).map(project => <option key={project.id} value={project.id}>{project.name} ({project.key})</option>)}</select></label>
          <label className="board-form-label mt-4 block">ASSIGNEE<select value={assigneeId} onChange={event => setAssigneeId(event.target.value)} className="board-form-input mt-2"><option value="">Unassigned</option>{members.map(member => <option key={member.user_id} value={member.user_id}>{member.name} · {member.role}</option>)}</select></label>
          <div className="mt-4 grid grid-cols-2 gap-3"><label className="board-form-label block">STATUS<select disabled={!!editingTask && !canMoveTask(editingTask)} value={initialStatus} onChange={event => setInitialStatus(event.target.value)} className="board-form-input mt-2 disabled:opacity-55">{columns.map(column => <option key={column}>{column}</option>)}</select></label><label className="board-form-label block">PRIORITY<select value={priority} onChange={event => setPriority(event.target.value)} className="board-form-input mt-2">{["urgent", "high", "medium", "low"].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
          {editingTask && initialStatus !== editingTask.status && <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-white/[.025] p-4">
            <p className="text-[12px] font-medium text-white/70">Add handoff context for {editingTask.status} → {initialStatus}</p>
            <label className="board-form-label block">WHAT HAVE YOU DONE?<textarea value={handoffDone} onChange={event => setHandoffDone(event.target.value)} required maxLength={2000} rows={3} className="board-form-input mt-2 resize-y" placeholder="Summarize the work completed."/></label>
            <label className="board-form-label block">WHAT DO YOU NEED NEXT?<textarea value={handoffNeeds} onChange={event => setHandoffNeeds(event.target.value)} required maxLength={2000} rows={3} className="board-form-input mt-2 resize-y" placeholder="Call out the next action, review, or help needed."/></label>
          </div>}
          {formError && <p role="alert" className="mt-3 flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-[12px] text-red-300"><AlertCircle size={14}/>{formError}</p>}
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setDialog(false)} className="board-dialog-cancel">Cancel</button><button disabled={saveTask.isPending || !projectId} className="board-dialog-submit">{saveTask.isPending ? "Saving…" : editingTask ? "Save task" : "Create task"}</button></div>
        </form>
      </div>}

      {taskToDelete && <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget && !deleteTask.isPending) setTaskToDelete(null); }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="delete-task-title" aria-describedby="delete-task-description" className="board-task-dialog w-full max-w-md rounded-[25px] p-6 shadow-2xl">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-300"><Trash2 size={18}/></span>
            <div className="min-w-0 flex-1">
              <h2 id="delete-task-title" className="text-[18px] font-semibold tracking-[-.025em]">Delete this task?</h2>
              <p id="delete-task-description" className="mt-2 text-[12px] leading-5 text-white/55">“{taskToDelete.title}” will be moved to trash and removed from the board.</p>
            </div>
            <button type="button" disabled={deleteTask.isPending} onClick={() => setTaskToDelete(null)} aria-label="Close delete task dialog" className="board-icon-button"><X size={16}/></button>
          </div>
          {deleteTask.error && <p role="alert" className="mt-4 rounded-xl border border-red-400/15 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-300">{deleteTask.error.message}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" disabled={deleteTask.isPending} onClick={() => setTaskToDelete(null)} className="board-dialog-cancel">Cancel</button>
            <button type="button" disabled={deleteTask.isPending} onClick={() => deleteTask.mutate(taskToDelete)} className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/15 px-4 py-2.5 text-[12px] font-semibold text-red-200 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={13}/>{deleteTask.isPending ? "Deleting…" : "Delete task"}</button>
          </div>
        </section>
      </div>}

      {moveDialog && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget && !move.isPending) setMoveDialog(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="handoff-title" className="board-task-dialog handoff-dialog my-6 w-full max-w-xl rounded-[25px] shadow-2xl">
          <header className="handoff-dialog-header">
            <div className="handoff-dialog-heading">
              <span className="handoff-dialog-icon"><CornerDownRight size={17}/></span>
              <div><span className="handoff-eyebrow">WORKFLOW HANDOFF</span><h2 id="handoff-title">Move work forward</h2><p>Add context so the next person knows where things stand.</p></div>
            </div>
            <button type="button" disabled={move.isPending} onClick={() => setMoveDialog(null)} aria-label="Close handoff dialog" className="board-icon-button"><X size={16}/></button>
          </header>
          <div className="handoff-dialog-body">
            <div className="handoff-task-summary"><span className="handoff-summary-icon"><ClipboardCheck size={16}/></span><div><span className="handoff-section-kicker">TASK</span><strong>{moveDialog.task.title}</strong></div></div>
            <div className="handoff-status-flow" aria-label={`Moving from ${moveDialog.task.status} to ${moveDialog.status}`}>
              <div className="handoff-status-stop"><span className="handoff-status-dot handoff-status-dot-current"/><span><small>FROM</small><strong>{moveDialog.task.status}</strong></span></div>
              <span className="handoff-flow-line"><ArrowRight size={15}/></span>
              <div className="handoff-status-stop"><span className="handoff-status-dot handoff-status-dot-next"/><span><small>TO</small><strong>{moveDialog.status}</strong></span></div>
            </div>
            <form onSubmit={submitMove} className="handoff-form">
              <div className="handoff-form-intro"><span>THE HANDOFF NOTE</span><span>Both fields are required</span></div>
              <label className="handoff-field"><span><CheckCircle2 size={14}/> What have you done?</span><textarea autoFocus value={handoffDone} onChange={event => setHandoffDone(event.target.value)} required maxLength={2000} rows={4} placeholder="Share completed work, progress, or decisions made."/><small><span>What should the lead know is complete?</span><span>{handoffDone.length}/2000</span></small></label>
              <label className="handoff-field handoff-field-next"><span><ArrowDownUp size={14}/> What do you need next?</span><textarea value={handoffNeeds} onChange={event => setHandoffNeeds(event.target.value)} required maxLength={2000} rows={4} placeholder="Call out the next step, review, or help needed."/><small><span>What will unblock or move this forward?</span><span>{handoffNeeds.length}/2000</span></small></label>
              {move.isError && <p role="alert" className="handoff-error"><AlertCircle size={14}/>{move.error.message}</p>}
              <footer className="handoff-dialog-footer"><span>Your lead can review this note in task history.</span><div><button type="button" disabled={move.isPending} onClick={() => setMoveDialog(null)} className="board-dialog-cancel">Cancel</button><button disabled={move.isPending || !handoffDone.trim() || !handoffNeeds.trim()} className="board-dialog-submit"><ArrowRight size={14}/>{move.isPending ? "Moving…" : "Confirm move"}</button></div></footer>
            </form>
          </div>
        </section>
      </div>}

      {historyTask && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setHistoryTask(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="history-title" className="board-task-dialog handoff-history-dialog my-6 w-full max-w-2xl rounded-[25px] shadow-2xl">
          <header className="handoff-history-header"><div className="handoff-history-title"><span className="handoff-history-icon"><History size={17}/></span><div><span className="handoff-eyebrow">TASK ACTIVITY</span><h2 id="history-title">Handoff history</h2><p>{historyTask.title}</p></div></div><div className="handoff-history-actions">{statusHistory.data?.length ? <span className="handoff-count">{statusHistory.data.length} {statusHistory.data.length === 1 ? "handoff" : "handoffs"}</span> : null}<button type="button" onClick={() => setHistoryTask(null)} aria-label="Close handoff history" className="board-icon-button"><X size={16}/></button></div></header>
          <div className="handoff-history-content">
            {statusHistory.isLoading ? <div className="handoff-history-message"><span className="handoff-history-message-icon"><History size={18}/></span><p>Loading task activity…</p></div>
              : statusHistory.isError ? <div role="alert" className="handoff-history-message handoff-history-message-error"><AlertCircle size={17}/><p>{statusHistory.error.message}</p></div>
              : !statusHistory.data?.length ? <div className="handoff-history-message"><span className="handoff-history-message-icon"><History size={18}/></span><strong>No handoffs yet</strong><p>When this task moves to another stage, its progress and next steps will appear here.</p></div>
              : <ol className="handoff-timeline">{statusHistory.data.map((transition, index) => <li key={transition.id} className="handoff-timeline-item">
                <span className={`handoff-timeline-marker ${index === 0 ? "handoff-timeline-marker-latest" : ""}`}><CheckCircle2 size={13}/></span>
                <article className="handoff-entry">
                  <header className="handoff-entry-header"><div className="handoff-entry-transition"><span>{transition.from_status}</span><ArrowRight size={13}/><strong>{transition.to_status}</strong></div><time>{readableDateTime(transition.created_at) ?? transition.created_at}</time></header>
                  <div className="handoff-entry-author"><span className="handoff-author-avatar">{initials(transition.actor_name)}</span><span><strong>{transition.actor_name}</strong><small>{index === 0 ? "Most recent handoff" : "Moved this task"}</small></span></div>
                  <div className="handoff-entry-notes">
                    <section><span className="handoff-note-icon handoff-note-icon-done"><CheckCircle2 size={13}/></span><div><h3>Completed</h3><p>{transition.work_done}</p></div></section>
                    <section><span className="handoff-note-icon handoff-note-icon-next"><ArrowDownUp size={13}/></span><div><h3>Next up</h3><p>{transition.next_needs}</p></div></section>
                  </div>
                </article>
              </li>)}</ol>}
          </div>
          <footer className="handoff-history-footer"><span>Showing the latest 100 status changes</span><button type="button" onClick={() => setHistoryTask(null)} className="board-dialog-cancel">Close history</button></footer>
        </section>
      </div>}
    </div>
  </>;
}

export default function BoardPage() {
  return <Suspense fallback={<div className="min-h-screen animate-pulse bg-[#10111a]"/>}><BoardContent/></Suspense>;
}
