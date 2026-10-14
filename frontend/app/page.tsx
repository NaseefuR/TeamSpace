"use client";

import "./overview.css";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, ArrowRight, ArrowUpRight, Check, CheckCircle2, Clock3, FolderKanban, Layers3, Sparkles, UsersRound } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, taskKey } from "@/lib/api";
import type { Project, Task, WorkspaceMember } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { useWorkspace } from "@/store/workspace";

const doneStatuses = ["done", "completed"];
const priorityWeight: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
function isDone(task: Task) { return doneStatuses.includes(task.status.toLowerCase()); }
function isOverdue(task: Task) { return !!task.due_at && new Date(task.due_at).getTime() < Date.now() && !isDone(task); }
function dueLabel(value?: string | null) { if (!value) return "No due date"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "No due date" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?"; }
function attentionReason(task: Task) {
  if (isOverdue(task)) return "Overdue";
  if (task.status.toLowerCase().includes("block")) return "Blocked";
  if (task.priority.toLowerCase() === "urgent") return "Urgent priority";
  if (task.priority.toLowerCase() === "high") return "High priority";
  return "Due soon";
}

function MetricCard({ label, value, note, icon: Icon, tone, index, href, onOpen }: { label: string; value: string; note: string; icon: typeof Clock3; tone: string; index: number; href: string; onOpen: (href: string) => void }) {
  return <button type="button" onClick={() => onOpen(href)} style={{ animationDelay: `${index * 75}ms` }} className={`overview-metric overview-metric-${tone} bento-enter group`}><span className="overview-metric-icon"><Icon size={16}/></span><span className="overview-metric-arrow"><ArrowUpRight size={13}/></span><strong>{value}</strong><span className="overview-metric-label">{label}</span><small>{note}</small></button>;
}

export default function Dashboard() {
  const router = useRouter();
  const user = useAuth(state => state.user);
  const selectedId = useWorkspace(state => state.selectedId);
  useEffect(() => { if (!useAuth.getState().tokens) router.replace("/login"); }, [router]);

  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces, enabled: !!user });
  const workspace = workspaces.data?.find(item => item.id === selectedId) ?? workspaces.data?.[0];
  const projects = useQuery({ queryKey: ["projects", workspace?.id], queryFn: () => api.projects(workspace!.id), enabled: !!workspace });
  const members = useQuery({ queryKey: ["members", workspace?.id], queryFn: () => api.members(workspace!.id), enabled: !!workspace });
  const taskQueries = useQueries({ queries: (projects.data ?? []).map(project => ({ queryKey: ["tasks", project.id], queryFn: () => api.tasks(project.id) })) });
  const tasks = useMemo(() => taskQueries.flatMap(query => query.data ?? []), [taskQueries]);
  const projectById = useMemo(() => Object.fromEntries((projects.data ?? []).map(project => [project.id, project])), [projects.data]);
  const memberById = useMemo(() => Object.fromEntries((members.data ?? []).map(member => [member.user_id, member])), [members.data]);
  const openTasks = tasks.filter(task => !isDone(task));
  const overdueTasks = tasks.filter(isOverdue);
  const doneCount = tasks.length - openTasks.length;
  const activeProjects = (projects.data ?? []).filter(project => project.status.toLowerCase() === "active").length;
  const completion = tasks.length ? Math.round(doneCount / tasks.length * 100) : 0;
  const statusOrder = ["Backlog", "Todo", "In Progress", "In Review", "Done"];
  const statusNames = Array.from(new Set(tasks.map(task => task.status))).sort((a, b) => {
    const aIndex = statusOrder.indexOf(a); const bIndex = statusOrder.indexOf(b);
    return (aIndex < 0 ? statusOrder.length : aIndex) - (bIndex < 0 ? statusOrder.length : bIndex) || a.localeCompare(b);
  });
  const statusData = statusNames.map(status => ({ status, count: tasks.filter(task => task.status === status).length }));
  const attentionTasks = openTasks.filter(task => {
    const due = task.due_at ? new Date(task.due_at).getTime() : 0;
    const dueSoon = due > Date.now() && due < Date.now() + 4 * 24 * 60 * 60 * 1000;
    return isOverdue(task) || task.status.toLowerCase().includes("block") || ["urgent", "high"].includes(task.priority.toLowerCase()) || dueSoon;
  }).sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || (priorityWeight[a.priority.toLowerCase()] ?? 4) - (priorityWeight[b.priority.toLowerCase()] ?? 4) || (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity)).slice(0, 6);
  const healthProjects = (projects.data ?? []).slice().sort((a, b) => ({ red: 0, amber: 1, green: 2 }[a.health.toLowerCase() as "red" | "amber" | "green"] ?? 3) - ({ red: 0, amber: 1, green: 2 }[b.health.toLowerCase() as "red" | "amber" | "green"] ?? 3)).slice(0, 5);
  const workload = (members.data ?? []).map(member => ({ member, count: openTasks.filter(task => task.assignee_id === member.user_id).length })).sort((a, b) => b.count - a.count || a.member.name.localeCompare(b.member.name)).slice(0, 5);
  const maximumWorkload = Math.max(1, ...workload.map(item => item.count));
  const atRisk = (projects.data ?? []).filter(project => project.health.toLowerCase() === "red").length;
  const loading = workspaces.isLoading || (!!workspace && (projects.isLoading || members.isLoading || taskQueries.some(query => query.isLoading)));
  const error = workspaces.error || projects.error || members.error || taskQueries.find(query => query.error)?.error;

  return <>
    <div className="overview-page">
      <section className="overview-hero bento-enter">
        <div className="overview-hero-grid" aria-hidden="true"/><div className="overview-hero-orbit overview-hero-orbit-one" aria-hidden="true"/><div className="overview-hero-orbit overview-hero-orbit-two" aria-hidden="true"/>
        <div className="overview-hero-main"><div className="overview-eyebrow"><span><Sparkles size={13}/></span> WORKSPACE OVERVIEW <i/> CURRENT SNAPSHOT</div><h1>Good work, <span>{user?.name?.split(/\s+/)[0] ?? "team"}.</span></h1><p>Here’s where {workspace?.name ?? "your workspace"} stands today. Find momentum, spot risk, and decide what needs your attention.</p><div className="overview-hero-actions"><button type="button" onClick={() => router.push("/board")} className="overview-primary-action">Open team board<ArrowRight size={14}/></button><button type="button" onClick={() => router.push("/ai")} className="overview-secondary-action"><Sparkles size={13}/>Ask AI</button><span className="overview-snapshot-label"><i/>Workspace data</span></div><div className="overview-hero-foot"><span><b>{loading ? "—" : projects.data?.length ?? 0}</b> projects</span><span><b>{loading ? "—" : openTasks.length}</b> open tasks</span><span className={atRisk > 0 ? "overview-risk-text" : ""}><b>{loading ? "—" : atRisk}</b> projects at risk</span></div></div>
        <div className="overview-progress-panel"><div className="overview-progress-ring" style={{ background: `conic-gradient(#8d78f7 ${completion}%, rgba(255,255,255,.09) ${completion}% 100%)` }} role="img" aria-label={`${completion}% of tasks completed`}><div><strong>{loading ? "—" : `${completion}%`}</strong><span>COMPLETE</span></div></div><div className="overview-progress-copy"><span>DELIVERY PULSE</span><strong>{loading ? "Loading work…" : `${doneCount} of ${tasks.length} tasks complete`}</strong><small>{loading ? "Gathering workspace data" : `${openTasks.length} still in progress`}</small></div><span className="overview-progress-spark"><Activity size={14}/></span></div>
      </section>

      {error && <div role="alert" className="overview-error"><AlertTriangle size={14}/>{error instanceof Error ? error.message : "Could not load workspace data."}</div>}
      {workspaces.data?.length === 0 && <div className="overview-no-workspace"><UsersRound size={17}/><span>You’re not a member of a workspace yet. Ask your workspace owner for an invitation.</span></div>}

      <div className="overview-metrics-grid"><MetricCard index={0} label="Open tasks" value={loading ? "—" : String(openTasks.length)} note="Across all projects" icon={Layers3} tone="violet" href="/board" onOpen={href => router.push(href)}/><MetricCard index={1} label="Completed" value={loading ? "—" : String(doneCount)} note={`${completion}% completion`} icon={CheckCircle2} tone="mint" href="/board" onOpen={href => router.push(href)}/><MetricCard index={2} label="Overdue" value={loading ? "—" : String(overdueTasks.length)} note="Past due, still open" icon={Clock3} tone="amber" href="/board" onOpen={href => router.push(href)}/><MetricCard index={3} label="Active projects" value={loading ? "—" : String(activeProjects)} note={`${projects.data?.length ?? 0} total projects`} icon={FolderKanban} tone="blue" href="/projects" onOpen={href => router.push(href)}/></div>

      <div className="overview-main-grid">
        <section className="overview-panel overview-chart-panel bento-enter"><header className="overview-panel-header"><div><span className="overview-section-kicker">DELIVERY PULSE</span><h2>Work by status</h2><p>Task distribution across this workspace</p></div><span className="overview-panel-count"><strong>{loading ? "—" : tasks.length}</strong> tasks</span></header><div className="overview-chart-wrap">{loading ? <div className="overview-chart-skeleton"><i/><i/><i/><i/><i/></div> : statusData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={statusData} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--overview-grid)"/><XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--overview-muted)" }} interval={0}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--overview-muted)" }}/><Tooltip cursor={{ fill: "var(--overview-tooltip-cursor)" }} contentStyle={{ borderRadius: 12, border: "1px solid #e6e6ef", boxShadow: "0 10px 28px rgba(24,26,42,.1)", fontSize: 10 }}/><Bar dataKey="count" name="Tasks" fill="#8069ee" radius={[6, 6, 2, 2]} maxBarSize={38}/></BarChart></ResponsiveContainer> : <div className="overview-chart-empty"><span><Activity size={19}/></span><strong>No task activity yet</strong><small>When tasks are created, their status distribution appears here.</small></div>}</div><div className="overview-chart-legend"><span><i/>Current task count by status</span><button type="button" onClick={() => router.push("/board")}>View board<ArrowUpRight size={12}/></button></div></section>

        <section className="overview-panel overview-project-panel bento-enter"><header className="overview-panel-header"><div><span className="overview-section-kicker">PROJECT HEALTH</span><h2>Project radar</h2><p>{atRisk ? `${atRisk} project${atRisk === 1 ? "" : "s"} need attention` : "Health signals across your projects"}</p></div><button type="button" onClick={() => router.push("/projects")} className="overview-panel-link">All projects<ArrowUpRight size={12}/></button></header><div className="overview-project-list">{loading ? [0, 1, 2].map(i => <div key={i} className="overview-project-skeleton"/>) : healthProjects.map((project: Project) => <button type="button" key={project.id} onClick={() => router.push(`/board?project=${project.id}`)} className="overview-project-row"><span className={`overview-project-glyph health-${project.health.toLowerCase()}`}><FolderKanban size={13}/></span><span className="overview-project-name"><strong>{project.name}</strong><small>{project.key} · {project.status.replaceAll("_", " ")}</small></span><span className={`overview-health-badge health-${project.health.toLowerCase()}`}><i/>{project.health}</span><ArrowUpRight size={12} className="overview-project-arrow"/></button>)}{!loading && healthProjects.length === 0 && <div className="overview-project-empty">Create a project to start tracking health.</div>}</div><button type="button" onClick={() => router.push("/projects")} className="overview-project-footer"><FolderKanban size={12}/>{projects.data?.length ?? 0} projects in this workspace<ArrowRight size={12}/></button></section>
      </div>

      <div className="overview-lower-grid">
        <section className="overview-panel overview-attention-panel bento-enter"><header className="overview-panel-header"><div><span className="overview-section-kicker">PRIORITIZED WORK</span><h2>Needs your attention</h2><p>Overdue, blocked, high-priority, or coming due soon</p></div><span className="overview-attention-count">{loading ? "—" : attentionTasks.length}</span></header><div className="overview-attention-list">{loading ? [0, 1, 2].map(i => <div key={i} className="overview-attention-skeleton"/>) : attentionTasks.map(task => { const project = projectById[task.project_id]; const assignee = task.assignee_id ? memberById[task.assignee_id] as WorkspaceMember | undefined : undefined; return <button type="button" key={task.id} onClick={() => router.push(`/board?project=${task.project_id}`)} className="overview-attention-row"><span className={`overview-attention-icon attention-${attentionReason(task).toLowerCase().replaceAll(" ", "-")}`}><AlertTriangle size={13}/></span><span className="overview-attention-task"><strong>{task.title}</strong><small>{project ? `${taskKey(project, task)} · ${project.name}` : `#${task.number}`}</small></span><span className={`overview-reason reason-${attentionReason(task).toLowerCase().replaceAll(" ", "-")}`}>{attentionReason(task)}</span><span className="overview-attention-meta"><small>{assignee?.name ?? "Unassigned"}</small><time>{dueLabel(task.due_at)}</time></span><ArrowUpRight size={12} className="overview-attention-arrow"/></button>; })}{!loading && attentionTasks.length === 0 && <div className="overview-attention-empty"><span><Check size={16}/></span><strong>No urgent signals</strong><small>No overdue, blocked, high-priority, or soon-due tasks found.</small></div>}</div><button type="button" onClick={() => router.push("/board")} className="overview-panel-footer">Open team board<ArrowRight size={12}/></button></section>

        <section className="overview-panel overview-workload-panel bento-enter"><header className="overview-panel-header"><div><span className="overview-section-kicker">TEAM CAPACITY</span><h2>Assigned workload</h2><p>Open tasks by workspace member</p></div><UsersRound size={15} className="overview-workload-header-icon"/></header><div className="overview-workload-list">{loading || members.isLoading ? [0, 1, 2].map(i => <div key={i} className="overview-workload-skeleton"/>) : workload.map(({ member, count }, index) => <div key={member.user_id} className="overview-workload-row"><span className={`overview-member-avatar member-tone-${index % 4}`}>{initials(member.name)}</span><span className="overview-workload-member"><strong>{member.name}</strong><small>{member.role.replaceAll("_", " ")}</small><i><b style={{ width: `${count ? Math.max(8, count / maximumWorkload * 100) : 0}%` }}/></i></span><span className="overview-workload-count">{count}<small>open</small></span></div>)}{!loading && !members.isLoading && workload.length === 0 && <div className="overview-workload-empty">Workspace members will appear here.</div>}</div><button type="button" onClick={() => router.push("/members")} className="overview-panel-footer">View members<ArrowRight size={12}/></button></section>
      </div>
    </div>
  </>;
}
