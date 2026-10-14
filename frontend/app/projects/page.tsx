"use client";

import "./projects.css";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  FolderKanban,
  Layers3,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { useWorkspace } from "@/store/workspace";

const filters = [
  { id: "all", label: "All projects" },
  { id: "active", label: "Active" },
  { id: "planned", label: "Planned" },
  { id: "on_hold", label: "On hold" },
  { id: "completed", label: "Completed" },
];

const projectStatus = (value: string) => value.replaceAll("_", " ");

function ProjectCard({ project, index, onOpen }: { project: Project; index: number; onOpen: (project: Project) => void }) {
  const health = (project.health || "amber").toLowerCase();
  const status = (project.status || "planned").toLowerCase();
  return <button type="button" onClick={() => onOpen(project)} className={`project-card project-card-tone-${index % 4} bento-enter group`}>
    <div className="project-card-aura" aria-hidden="true"/>
    <div className="project-card-top">
      <span className="project-card-mark"><FolderKanban size={18}/><span className="project-card-mark-orbit"/></span>
      <span className={`project-status project-status-${status}`}><i/>{projectStatus(project.status)}</span>
    </div>

    <div className="project-card-title-row">
      <div className="min-w-0"><h2 className="truncate">{project.name}</h2><span className="project-card-key">{project.key}</span></div>
      <span className="project-open-icon"><ArrowUpRight size={16}/></span>
    </div>

    <div className="project-card-signal-row">
      <span className="project-health"><i className={`project-health-dot project-health-${health}`}/><span className="project-health-label">Project health</span><strong className={`project-health-value project-health-text-${health}`}>{health}</strong></span>
      <span className="project-card-space"><Layers3 size={11}/>{project.team_id ? "Team project" : "Workspace project"}</span>
    </div>

    <div className="project-card-footer"><span><Activity size={13}/>Open project board</span><ChevronRight size={14}/></div>
    <span className="project-card-index">{String(index + 1).padStart(2, "0")}</span>
  </button>;
}

export default function ProjectsPage() {
  const router = useRouter();
  const user = useAuth(state => state.user);
  const selectedId = useWorkspace(state => state.selectedId);
  const client = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formError, setFormError] = useState("");

  useEffect(() => { if (!useAuth.getState().tokens) router.replace("/login"); }, [router]);

  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces, enabled: !!user });
  const workspace = workspaces.data?.find(item => item.id === selectedId) ?? workspaces.data?.[0];
  const projects = useQuery({ queryKey: ["projects", workspace?.id], queryFn: () => api.projects(workspace!.id), enabled: !!workspace });
  const projectList = projects.data ?? [];
  const create = useMutation({
    mutationFn: () => api.createProject(workspace!.id, name.trim(), key.trim().toUpperCase()),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["projects", workspace?.id] });
      setDialog(false); setName(""); setKey(""); setFormError("");
    },
    onError: error => setFormError(error.message),
  });

  const visibleProjects = useMemo(() => projectList.filter(project => {
    const matchesStatus = statusFilter === "all" || project.status.toLowerCase() === statusFilter;
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || `${project.name} ${project.key} ${project.status} ${project.health}`.toLowerCase().includes(needle);
    return matchesStatus && matchesSearch;
  }), [projectList, statusFilter, search]);
  const activeCount = projectList.filter(project => project.status.toLowerCase() === "active").length;
  const riskCount = projectList.filter(project => project.health.toLowerCase() === "red").length;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^[A-Z][A-Z0-9]{1,15}$/.test(key.trim().toUpperCase())) {
      setFormError("Use 2–16 letters or numbers; the first character must be a letter.");
      return;
    }
    if (!workspace) { setFormError("Choose a workspace before creating a project."); return; }
    setFormError(""); create.mutate();
  }

  function openCreate() { setFormError(""); create.reset(); setName(""); setKey(""); setDialog(true); }
  function openProject(project: Project) { router.push(`/board?project=${project.id}`); }

  const loading = workspaces.isLoading || projects.isLoading;
  return <>
    <div className="project-page">
      <section className="project-hero bento-enter">
        <div className="project-hero-grid" aria-hidden="true"/>
        <div className="project-hero-orbit project-hero-orbit-one" aria-hidden="true"/>
        <div className="project-hero-orbit project-hero-orbit-two" aria-hidden="true"/>
        <div className="project-hero-copy">
          <div className="project-eyebrow"><span><FolderKanban size={13}/></span> PROJECT SPACE <i/> PLAN · BUILD · SHIP</div>
          <h1>Projects<span>.</span></h1>
          <p>A clear view of the initiatives and workstreams across your team.</p>
          <div className="project-hero-workspace"><span className="project-workspace-pulse"/>{workspace?.name ?? "Select a workspace"}<ChevronRight size={11}/><span>Project directory</span></div>
        </div>
        <div className="project-hero-insights">
          <div className="project-insight project-insight-primary"><span className="project-insight-label"><Layers3 size={12}/> PROJECTS</span><strong>{loading ? "—" : String(projectList.length).padStart(2, "0")}</strong><span className="project-insight-caption">in this workspace</span></div>
          <div className="project-insight"><span className="project-insight-label"><Activity size={12}/> ACTIVE</span><strong>{loading ? "—" : String(activeCount).padStart(2, "0")}</strong><span className="project-insight-caption">moving forward</span></div>
          <div className={`project-insight ${riskCount ? "project-insight-alert" : ""}`}><span className="project-insight-label"><AlertTriangle size={12}/> AT RISK</span><strong>{loading ? "—" : String(riskCount).padStart(2, "0")}</strong><span className="project-insight-caption">{riskCount ? "need attention" : "no red flags"}</span></div>
        </div>
        <span className="project-hero-spark"><Sparkles size={15}/></span>
      </section>

      <section className="project-directory bento-enter">
        <div className="project-directory-head">
          <div className="project-directory-heading"><span className="project-directory-icon"><Layers3 size={15}/></span><div><h2>Project directory</h2><p>Browse and open your team’s workspaces</p></div></div>
          <div className="project-directory-tools">
            <label className="project-search"><Search size={15}/><input type="search" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search projects" placeholder="Search name or key…"/>{search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={13}/></button>}</label>
            <button type="button" onClick={openCreate} disabled={!workspace} className="project-create-button"><Plus size={15}/>New project</button>
          </div>
        </div>
        <div className="project-directory-filters" role="tablist" aria-label="Filter projects by status">
          {filters.map(filter => {
            const count = filter.id === "all" ? projectList.length : projectList.filter(project => project.status.toLowerCase() === filter.id).length;
            return <button type="button" role="tab" aria-selected={statusFilter === filter.id} key={filter.id} onClick={() => setStatusFilter(filter.id)} className={`project-filter ${statusFilter === filter.id ? "project-filter-active" : ""}`}><span>{filter.label}</span><span className="project-filter-count">{count}</span></button>;
          })}
          <span className="project-view-count">Showing <strong>{visibleProjects.length}</strong> of {projectList.length}</span>
        </div>
      </section>

      {loading ? <div className="project-grid">{[0, 1, 2, 3, 4, 5].map(item => <div className="project-skeleton" key={item}><div/><span/><span/></div>)}</div>
        : projects.error ? <div role="alert" className="project-error"><AlertTriangle size={15}/>{projects.error.message}</div>
        : visibleProjects.length > 0 ? <div className="project-grid">{visibleProjects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} onOpen={openProject}/>)}</div>
        : <div className="project-empty-state"><span className="project-empty-icon"><FolderKanban size={21}/></span><h2>{search || statusFilter !== "all" ? "No projects match this view" : "Your project space is ready"}</h2><p>{search || statusFilter !== "all" ? "Try changing the search or status filter." : "Create your first project to give the team’s work a home."}</p>{search || statusFilter !== "all" ? <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear filters</button> : <button type="button" onClick={openCreate}><Plus size={14}/>Create a project</button>}</div>}

      {dialog && <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setDialog(false); }}>
        <form onSubmit={submit} className="project-dialog my-6 w-full max-w-md rounded-[24px] p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><span className="project-dialog-icon"><FolderKanban size={18}/></span><h2 className="mt-4 text-[19px] font-semibold tracking-[-.03em]">Create a project</h2><p className="mt-1 text-[11px] text-white/45">Give this workstream a clear name and a memorable key.</p></div><button type="button" onClick={() => setDialog(false)} aria-label="Close dialog" className="project-dialog-close"><X size={16}/></button></div>
          <label className="project-form-label mt-5 block">PROJECT NAME<input autoFocus value={name} onChange={event => { setName(event.target.value); if (!key || key === keyFromName(name)) setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)); }} required maxLength={160} className="project-form-input mt-2" placeholder="Platform API"/></label>
          <label className="project-form-label mt-4 block">PROJECT KEY<input value={key} onChange={event => setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))} required minLength={2} maxLength={16} className="project-form-input project-form-key mt-2" placeholder="PLAT"/><span className="project-form-hint">Task IDs will use this key, for example <strong>{key.trim().toUpperCase() || "PLAT"}-12</strong>.</span></label>
          {formError && <p role="alert" className="project-form-error"><AlertTriangle size={13}/>{formError}</p>}
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setDialog(false)} className="project-dialog-cancel">Cancel</button><button disabled={create.isPending || !workspace} className="project-dialog-submit">{create.isPending ? "Creating…" : "Create project"}</button></div>
        </form>
      </div>}
    </div>
  </>;
}

function keyFromName(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); }
