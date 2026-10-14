"use client";

import "./members.css";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  BriefcaseBusiness,
  ChevronDown,
  Crown,
  LockKeyhole,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { WorkspaceMember } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { useWorkspace } from "@/store/workspace";

type Role = "admin" | "member" | "guest";
const roleFilters = ["all", "owner", "admin", "member", "guest"];
const avatarColors = ["plum", "mint", "amber", "blue", "rose", "teal"];
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
const dateJoined = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", year: "numeric" }); };

function MemberCard({ member, index, isCurrentUser }: { member: WorkspaceMember; index: number; isCurrentUser: boolean }) {
  return <article className="member-card bento-enter">
    <div className={`member-card-aura member-aura-${index % 4}`} aria-hidden="true"/>
    <div className="member-card-top"><span className={`member-avatar member-avatar-${avatarColors[index % avatarColors.length]}`}>{initials(member.name)}</span><span className={`member-role member-role-${member.role}`}><i/>{member.role === "owner" && <Crown size={10} />}{member.role}</span></div>
    <div className="member-card-identity"><div className="flex min-w-0 items-center gap-2"><h2 className="truncate">{member.name}</h2>{isCurrentUser && <span className="member-you-tag">YOU</span>}</div><p>{member.designation || "No designation set"}</p></div>
    <div className="member-card-contact"><span className="member-contact-icon"><AtSign size={11}/></span><span className="truncate">{member.email}</span></div>
    <div className="member-card-footer"><span><BriefcaseBusiness size={12}/>{member.designation || "Workspace member"}</span>{dateJoined(member.joined_at) && <span>Joined {dateJoined(member.joined_at)}</span>}</div>
  </article>;
}

export default function MembersPage() {
  const router = useRouter();
  const user = useAuth(state => state.user);
  const selectedId = useWorkspace(state => state.selectedId);
  const client = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [mode, setMode] = useState<"existing" | "create">("existing");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => { if (!useAuth.getState().tokens) router.replace("/login"); }, [router]);

  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces, enabled: !!user });
  const workspace = workspaces.data?.find(item => item.id === selectedId) ?? workspaces.data?.[0];
  const members = useQuery({ queryKey: ["members", workspace?.id], queryFn: () => api.members(workspace!.id), enabled: !!workspace });
  const memberList = members.data ?? [];
  const currentRole = memberList.find(member => member.user_id === user?.id)?.role;
  const canManage = currentRole === "owner" || currentRole === "admin";
  const ownerCount = memberList.filter(member => member.role === "owner" || member.role === "admin").length;
  const contributorCount = memberList.filter(member => member.role === "member").length;

  function afterAdd() {
    client.invalidateQueries({ queryKey: ["members", workspace?.id] });
    client.invalidateQueries({ queryKey: ["notifications"] });
    setDialog(false); setName(""); setEmail(""); setPassword(""); setRole("member");
  }
  const addExisting = useMutation({ mutationFn: () => api.addMember(workspace!.id, email.trim(), role), onSuccess: afterAdd });
  const createAccount = useMutation({ mutationFn: () => api.createMemberAccount(workspace!.id, { name: name.trim(), email: email.trim(), password, role }), onSuccess: afterAdd });

  function openDialog() {
    addExisting.reset(); createAccount.reset(); setMode("existing"); setName(""); setEmail(""); setPassword(""); setRole("member"); setDialog(true);
  }
  function submit(event: FormEvent) { event.preventDefault(); if (!workspace) return; if (mode === "create") createAccount.mutate(); else addExisting.mutate(); }

  const visibleMembers = useMemo(() => memberList.filter(member => {
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || `${member.name} ${member.email} ${member.role} ${member.designation ?? ""}`.toLowerCase().includes(needle);
    return matchesRole && matchesSearch;
  }), [memberList, roleFilter, search]);
  const mutationError = mode === "create" ? createAccount.error : addExisting.error;
  const isPending = addExisting.isPending || createAccount.isPending;
  const loading = workspaces.isLoading || members.isLoading;

  return <>
    <div className="members-page">
      <section className="members-hero bento-enter">
        <div className="members-hero-grid" aria-hidden="true"/><div className="members-hero-orbit members-hero-orbit-one" aria-hidden="true"/><div className="members-hero-orbit members-hero-orbit-two" aria-hidden="true"/>
        <div className="members-hero-copy"><div className="members-eyebrow"><span><UsersRound size={13}/></span> PEOPLE & PERMISSIONS <i/> YOUR TEAM</div><h1>Members<span>.</span></h1><p>Manage the people, roles, and access that keep this workspace moving.</p><div className="members-workspace-chip"><span/>{workspace?.name ?? "Select a workspace"}<ChevronDown size={11}/><span className="members-chip-label">Directory</span></div></div>
        <div className="members-hero-stats"><div className="members-stat members-stat-primary"><span><UsersRound size={12}/> PEOPLE</span><strong>{loading ? "—" : String(memberList.length).padStart(2, "0")}</strong><small>in this workspace</small></div><div className="members-stat"><span><ShieldCheck size={12}/> ADMINS</span><strong>{loading ? "—" : String(ownerCount).padStart(2, "0")}</strong><small>owners and admins</small></div><div className="members-stat"><span><BriefcaseBusiness size={12}/> MEMBERS</span><strong>{loading ? "—" : String(contributorCount).padStart(2, "0")}</strong><small>active contributors</small></div></div>
        <span className="members-hero-spark"><Sparkles size={15}/></span>
      </section>

      <section className="members-directory bento-enter">
        <div className="members-directory-top"><div className="members-directory-heading"><span className="members-directory-icon"><UsersRound size={15}/></span><div><h2>Workspace directory</h2><p>Find teammates and understand their access</p></div></div><div className="members-directory-actions"><label className="members-search"><Search size={14}/><input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search members" placeholder="Search people…"/>{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={13}/></button>}</label><button type="button" onClick={canManage ? openDialog : undefined} disabled={!canManage || !workspace} title={canManage ? "Add an existing account or create a new one" : "Only workspace owners and admins can add members"} className="members-add-button"><Plus size={15}/>{canManage ? "Add member" : <><LockKeyhole size={12}/>Add member</>}</button></div></div>
        <div className="members-directory-bottom"><div className="members-role-filters" role="tablist" aria-label="Filter members by role">{roleFilters.map(filter => { const count = filter === "all" ? memberList.length : memberList.filter(member => member.role === filter).length; return <button key={filter} type="button" role="tab" aria-selected={roleFilter === filter} onClick={() => setRoleFilter(filter)} className={`members-role-filter ${roleFilter === filter ? "members-role-filter-active" : ""}`}><span>{filter === "all" ? "Everyone" : filter}</span><span>{count}</span></button>; })}</div><span className="members-visible-count">Showing <strong>{visibleMembers.length}</strong> of {memberList.length}</span></div>
      </section>

      {loading ? <div className="members-grid">{[0, 1, 2, 3, 4, 5].map(index => <div className="member-skeleton" key={index}><i/><span/><span/></div>)}</div>
        : members.error ? <div role="alert" className="members-error"><ShieldCheck size={15}/>{members.error.message}</div>
        : !workspace ? <div className="members-empty"><span className="members-empty-icon"><UsersRound size={20}/></span><h2>No workspace selected</h2><p>Choose a workspace to view its member directory.</p></div>
        : visibleMembers.length ? <div className="members-grid">{visibleMembers.map((member, index) => <MemberCard key={member.user_id} member={member} index={index} isCurrentUser={member.user_id === user?.id}/>)}</div>
        : <div className="members-empty"><span className="members-empty-icon"><UsersRound size={20}/></span><h2>{search || roleFilter !== "all" ? "No people match this view" : "Your directory is empty"}</h2><p>{search || roleFilter !== "all" ? "Try a different name, email, or access level." : "Add a teammate to start building your workspace."}</p>{search || roleFilter !== "all" ? <button type="button" onClick={() => { setSearch(""); setRoleFilter("all"); }}>Clear filters</button> : canManage ? <button type="button" onClick={openDialog}><Plus size={13}/>Add a member</button> : null}</div>}

      <div className="members-permission-note"><span className="members-permission-icon"><ShieldCheck size={14}/></span><p>{canManage ? <>Your role is <strong>{currentRole}</strong>. You can add existing accounts or create teammate accounts from this directory.</> : currentRole ? <>Your role is <strong>{currentRole}</strong>. Workspace owners and admins manage member access.</> : "Member permissions are available once this workspace finishes loading."}</p><span className="members-permission-workspace">{workspace?.slug ?? "WORKSPACE ACCESS"}</span></div>

      {dialog && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setDialog(false); }}>
        <form onSubmit={submit} className="members-dialog my-6 w-full max-w-md rounded-[24px] p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><span className="members-dialog-icon"><UserPlus size={18}/></span><h2 className="mt-4 text-[18px] font-semibold tracking-[-.03em]">Add a workspace member</h2><p className="mt-1 text-[11px] text-white/45">Invite an existing account or create one for your teammate.</p></div><button type="button" onClick={() => setDialog(false)} aria-label="Close dialog" className="members-dialog-close"><X size={16}/></button></div>
          <div className="members-mode-switch"><button type="button" onClick={() => { setMode("existing"); addExisting.reset(); createAccount.reset(); }} className={mode === "existing" ? "active" : ""}><Mail size={12}/>Existing account</button><button type="button" onClick={() => { setMode("create"); addExisting.reset(); createAccount.reset(); }} className={mode === "create" ? "active" : ""}><UserPlus size={12}/>Create account</button></div>
          {mode === "create" && <label className="members-form-label mt-4 block">FULL NAME<input autoFocus type="text" required minLength={1} maxLength={160} value={name} onChange={event => setName(event.target.value)} className="members-form-input mt-2" placeholder="Jamie Developer"/></label>}
          <label className="members-form-label mt-4 block">ACCOUNT EMAIL<input autoFocus={mode === "existing"} type="email" required maxLength={320} value={email} onChange={event => setEmail(event.target.value)} className="members-form-input mt-2" placeholder="developer@example.com"/></label>
          {mode === "create" && <><label className="members-form-label mt-4 block">INITIAL PASSWORD<input type="password" required minLength={12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} className="members-form-input mt-2" placeholder="At least 12 characters"/></label><p className="members-password-hint">Share this initial password privately. Your teammate can change it after signing in.</p></>}
          <label className="members-form-label mt-4 block">WORKSPACE ROLE<select value={role} onChange={event => setRole(event.target.value as Role)} className="members-form-input mt-2"><option value="member">Member</option><option value="guest">Guest</option>{currentRole === "owner" && <option value="admin">Admin</option>}</select></label>
          {mutationError && <p role="alert" className="members-form-error">{mutationError.message}</p>}
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setDialog(false)} className="members-dialog-cancel">Cancel</button><button disabled={isPending} className="members-dialog-submit">{isPending ? "Saving…" : mode === "create" ? "Create account" : "Add member"}</button></div>
        </form>
      </div>}
    </div>
  </>;
}
