"use client";

import "./settings.css";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Command,
  LockKeyhole,
  Moon,
  Palette,
  Save,
  Settings2,
  ShieldCheck,
  Sun,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { useWorkspace } from "@/store/workspace";

type Theme = "dark" | "light";
export default function SettingsPage() {
  const router = useRouter();
  const client = useQueryClient();
  const user = useAuth(state => state.user);
  const setUser = useAuth(state => state.setUser);
  const selectedId = useWorkspace(state => state.selectedId);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [profileSaved, setProfileSaved] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  const [theme, setTheme] = useState<Theme>("dark");
  const [workspaceSaved, setWorkspaceSaved] = useState(false);
  const [activeSection, setActiveSection] = useState("profile");

  useEffect(() => { if (!useAuth.getState().tokens) router.replace("/login"); }, [router]);
  useEffect(() => {
    setName(user?.name ?? ""); setDesignation(user?.designation ?? ""); setTimezone(user?.timezone ?? "UTC");
  }, [user?.id]);
  useEffect(() => {
    const selectedTheme = localStorage.getItem("teamspace-theme") === "light" ? "light" : "dark";
    setTheme(selectedTheme);
  }, []);

  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces, enabled: !!user });
  const workspace = workspaces.data?.find(item => item.id === selectedId) ?? workspaces.data?.[0];
  const members = useQuery({ queryKey: ["members", workspace?.id], queryFn: () => api.members(workspace!.id), enabled: !!workspace });
  const workspaceRole = members.data?.find(member => member.user_id === user?.id)?.role;
  const canManageWorkspace = workspaceRole === "owner" || workspaceRole === "admin";

  useEffect(() => {
    setWorkspaceName(workspace?.name ?? ""); setWorkspaceSlug(workspace?.slug ?? ""); setWorkspaceDescription(workspace?.description ?? "");
  }, [workspace?.id]);

  const saveProfile = useMutation({
    mutationFn: () => api.updateProfile({ name: name.trim(), designation: designation.trim() || null, timezone: timezone.trim() }),
    onSuccess: updatedUser => { setUser(updatedUser); client.setQueryData(["me"], updatedUser); setProfileSaved(true); },
  });
  const saveWorkspace = useMutation({
    mutationFn: () => api.updateWorkspace(workspace!.id, { name: workspaceName.trim(), slug: workspaceSlug.trim(), description: workspaceDescription.trim() || null }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ["workspaces"] }); setWorkspaceSaved(true); },
  });

  function submitProfile(event: FormEvent) { event.preventDefault(); setProfileSaved(false); saveProfile.mutate(); }
  function submitWorkspace(event: FormEvent) {
    event.preventDefault();
    if (!/^[a-z0-9-]{2,100}$/.test(workspaceSlug.trim())) return;
    setWorkspaceSaved(false); saveWorkspace.mutate();
  }
  function changeTheme(value: Theme) {
    setTheme(value); localStorage.setItem("teamspace-theme", value);
    document.documentElement.classList.toggle("orbit-light", value === "light");
    window.dispatchEvent(new Event("teamspace-theme-change"));
  }

  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "YO";
  const workspaceError = saveWorkspace.error?.message || (workspaceSlug && !/^[a-z0-9-]{2,100}$/.test(workspaceSlug) ? "Use 2–100 lowercase letters, numbers, or hyphens." : "");

  return <>
    <div className="settings-page">
      <section className="settings-hero bento-enter">
        <div className="settings-hero-grid" aria-hidden="true"/><div className="settings-hero-orbit settings-hero-orbit-one" aria-hidden="true"/><div className="settings-hero-orbit settings-hero-orbit-two" aria-hidden="true"/>
        <div className="settings-hero-copy"><div className="settings-eyebrow"><span><Settings2 size={13}/></span> PERSONALIZE YOUR SPACE <i/> CONTROL CENTER</div><h1>Settings<span>.</span></h1><p>Shape your profile, workspace, and the way Orbit feels.</p><div className="settings-hero-context"><span className="settings-live-dot"/>{workspace?.name ?? "Your workspace"}<ChevronRight size={11}/><span>Preferences</span></div></div>
        <div className="settings-hero-profile"><span className="settings-hero-avatar">{initials}</span><div><span>SIGNED IN AS</span><strong>{user?.name ?? "Your account"}</strong><small>{user?.email ?? ""}</small></div></div><span className="settings-hero-spark"><Command size={15}/></span>
      </section>

      <div className="settings-layout">
        <nav className="settings-nav bento-enter" aria-label="Settings sections"><span className="settings-nav-label">PREFERENCES</span><a href="#profile" onClick={() => setActiveSection("profile")} aria-current={activeSection === "profile" ? "location" : undefined} className={`settings-nav-link ${activeSection === "profile" ? "settings-nav-active" : ""}`}><UserRound size={15}/><span>My profile</span><ChevronRight size={13}/></a><a href="#workspace" onClick={() => setActiveSection("workspace")} aria-current={activeSection === "workspace" ? "location" : undefined} className={`settings-nav-link ${activeSection === "workspace" ? "settings-nav-active" : ""}`}><UsersRound size={15}/><span>Workspace</span><ChevronRight size={13}/></a><a href="#appearance" onClick={() => setActiveSection("appearance")} aria-current={activeSection === "appearance" ? "location" : undefined} className={`settings-nav-link ${activeSection === "appearance" ? "settings-nav-active" : ""}`}><Palette size={15}/><span>Appearance</span><ChevronRight size={13}/></a><div className="settings-nav-divider"/><span className="settings-nav-label">QUICK ACCESS</span><Link href="/notifications" className="settings-nav-link"><Bell size={15}/><span>Notifications</span><ArrowUpRight size={12}/></Link><div className="settings-nav-note"><ShieldCheck size={13}/><span>Your settings are saved to your account or workspace.</span></div></nav>

        <main className="settings-sections">
          <section id="profile" className="settings-section bento-enter">
            <header className="settings-section-header"><span className="settings-section-icon"><UserRound size={16}/></span><div><h2>My profile</h2><p>Personal details shown to people in your workspace.</p></div><span className="settings-section-status"><i/>ACCOUNT</span></header>
            <form onSubmit={submitProfile} className="settings-form"><div className="settings-profile-summary"><span className="settings-profile-avatar">{initials}</span><div><strong>{user?.name ?? "Your name"}</strong><span>{user?.email ?? ""}</span></div><span className="settings-readonly-tag"><LockKeyhole size={10}/>Email verified</span></div><div className="settings-form-grid"><label className="settings-label">FULL NAME<input required minLength={1} maxLength={160} value={name} onChange={event => { setName(event.target.value); setProfileSaved(false); }} className="settings-input" placeholder="Your name"/></label><label className="settings-label">DESIGNATION <span>OPTIONAL</span><input maxLength={160} value={designation} onChange={event => { setDesignation(event.target.value); setProfileSaved(false); }} className="settings-input" placeholder="e.g. Engineering lead"/></label><label className="settings-label">EMAIL ADDRESS<input disabled value={user?.email ?? ""} className="settings-input settings-input-disabled"/><small>Email changes are managed by your account provider.</small></label><label className="settings-label">TIME ZONE<input required maxLength={64} value={timezone} onChange={event => { setTimezone(event.target.value); setProfileSaved(false); }} className="settings-input" placeholder="Asia/Kolkata"/></label></div><div className="settings-form-footer"><span>{profileSaved ? <><CheckCircle2 size={13}/>Profile changes saved</> : saveProfile.error ? <span className="settings-error-text"><X size={13}/>{saveProfile.error.message}</span> : <><ShieldCheck size={13}/>Only your name, designation, and timezone are editable here.</>}</span><button disabled={saveProfile.isPending || !name.trim() || !timezone.trim()} className="settings-save-button"><Save size={13}/>{saveProfile.isPending ? "Saving…" : "Save profile"}</button></div></form>
          </section>

          <section id="workspace" className="settings-section bento-enter">
            <header className="settings-section-header"><span className="settings-section-icon settings-icon-workspace"><UsersRound size={16}/></span><div><h2>Workspace settings</h2><p>Update the name and identity of your current workspace.</p></div><span className={`settings-section-status ${canManageWorkspace ? "" : "settings-section-locked"}`}>{canManageWorkspace ? <><i/>WORKSPACE</> : <><LockKeyhole size={10}/>READ ONLY</>}</span></header>
            {!workspace ? <div className="settings-empty-workspace"><UsersRound size={17}/>Choose a workspace to manage its settings.</div> : <form onSubmit={submitWorkspace} className="settings-form"><div className="settings-workspace-summary"><span className="settings-workspace-glyph">{workspace.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "WS"}</span><div><strong>{workspace.name}</strong><span>{workspace.slug}</span></div><span className="settings-role-badge">{workspaceRole ?? "member"}</span></div><div className="settings-form-grid"><label className="settings-label">WORKSPACE NAME<input disabled={!canManageWorkspace} required maxLength={160} value={workspaceName} onChange={event => { setWorkspaceName(event.target.value); setWorkspaceSaved(false); }} className="settings-input" placeholder="Platform team"/></label><label className="settings-label">WORKSPACE SLUG<input disabled={!canManageWorkspace} required minLength={2} maxLength={100} pattern="[a-z0-9-]+" value={workspaceSlug} onChange={event => { setWorkspaceSlug(event.target.value); setWorkspaceSaved(false); }} className="settings-input" placeholder="platform-team"/><small>Used as the workspace’s unique identifier.</small></label><label className="settings-label settings-label-wide">DESCRIPTION <span>OPTIONAL</span><textarea disabled={!canManageWorkspace} maxLength={2000} rows={3} value={workspaceDescription} onChange={event => { setWorkspaceDescription(event.target.value); setWorkspaceSaved(false); }} className="settings-input settings-textarea" placeholder="What this workspace is for"/></label></div><div className="settings-form-footer"><span>{workspaceSaved ? <><CheckCircle2 size={13}/>Workspace changes saved</> : workspaceError ? <span className="settings-error-text"><X size={13}/>{workspaceError}</span> : <>{canManageWorkspace ? <ShieldCheck size={13}/> : <LockKeyhole size={13}/>} {canManageWorkspace ? "Owners and admins can edit workspace details." : "Ask a workspace owner or admin to make changes."}</>}</span><button disabled={!canManageWorkspace || saveWorkspace.isPending || !workspaceName.trim() || !workspaceSlug.trim()} className="settings-save-button">{canManageWorkspace ? <><Save size={13}/>{saveWorkspace.isPending ? "Saving…" : "Save workspace"}</> : <><LockKeyhole size={12}/>Owner access required</>}</button></div></form>}
          </section>

          <section id="appearance" className="settings-section bento-enter">
            <header className="settings-section-header"><span className="settings-section-icon settings-icon-appearance"><Palette size={16}/></span><div><h2>Appearance</h2><p>Choose the visual theme for your workspace.</p></div><span className="settings-section-status"><i/>SAVED AUTOMATICALLY</span></header>
            <div className="settings-theme-options"><button type="button" aria-pressed={theme === "dark"} onClick={() => changeTheme("dark")} className={`settings-theme-card settings-theme-dark ${theme === "dark" ? "settings-theme-selected" : ""}`}><span className="settings-theme-preview"><i/><i/><i/><b/><em/></span><span className="settings-theme-copy"><strong><Moon size={13}/>Dark</strong><small>Low-light, orbital workspace</small></span><span className="settings-theme-check">{theme === "dark" && <Check size={12}/>}</span></button><button type="button" aria-pressed={theme === "light"} onClick={() => changeTheme("light")} className={`settings-theme-card settings-theme-light ${theme === "light" ? "settings-theme-selected" : ""}`}><span className="settings-theme-preview"><i/><i/><i/><b/><em/></span><span className="settings-theme-copy"><strong><Sun size={13}/>Light</strong><small>Bright, calm workspace</small></span><span className="settings-theme-check">{theme === "light" && <Check size={12}/>}</span></button></div>
            <div className="settings-appearance-foot"><span><CheckCircle2 size={13}/>Your theme preference is stored in this browser.</span><span>Motion respects your device’s reduced-motion setting.</span></div>
          </section>

          <Link href="/notifications" className="settings-notification-link"><span className="settings-notification-icon"><Bell size={15}/></span><span><strong>Notification center</strong><small>Review and manage your recent workspace updates.</small></span><ArrowUpRight size={14}/></Link>
        </main>
      </div>
    </div>
  </>;
}
