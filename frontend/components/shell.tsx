"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, Bell, BookOpen, ChevronDown, Command, FolderKanban, LayoutDashboard, LogOut, MessageSquareText, Moon, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Settings2, Sparkles, Sun, UsersRound, X, KanbanSquare } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/store/auth";
import { useWorkspace } from "@/store/workspace";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const primaryNav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/board", label: "Team board", icon: KanbanSquare },
  { href: "/ai", label: "AI assistant", icon: Sparkles },
];
const teamNav = [
  { href: "/channels", label: "Channels", icon: MessageSquareText },
  { href: "/docs", label: "Team docs", icon: BookOpen },
  { href: "/members", label: "Members", icon: UsersRound },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings2 },
];
const pageName = [...primaryNav, ...teamNav].reduce<Record<string, string>>((map, item) => ({ ...map, [item.href]: item.label }), {});
const workspaceMonogram = (name?: string) => name?.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "WS";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const clear = useAuth((state) => state.clear);
  const selectedId = useWorkspace((state) => state.selectedId);
  const select = useWorkspace((state) => state.select);
  const client = useQueryClient();
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces, enabled: !!user });
  const activeWorkspace = workspaces.data?.find((workspace) => workspace.id === selectedId) ?? workspaces.data?.[0];
  const members = useQuery({ queryKey: ["members", activeWorkspace?.id], queryFn: () => api.members(activeWorkspace!.id), enabled: !!user && !!activeWorkspace });
  const unread = useQuery({ queryKey: ["notifications", "unread-count"], queryFn: api.unreadCount, enabled: !!user, refetchInterval: 30_000 });
  const canManage = !!members.data?.some((member) => member.user_id === user?.id && ["owner", "admin"].includes(member.role));
  const [dark, setDark] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspaceDialog, setWorkspaceDialog] = useState<"create" | "edit" | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  const [workspaceError, setWorkspaceError] = useState("");

  const createWorkspace = useMutation({
    mutationFn: () => api.createWorkspace({ name: workspaceName.trim(), slug: workspaceSlug.trim(), description: workspaceDescription.trim() || undefined }),
    onSuccess: (workspace) => { client.invalidateQueries({ queryKey: ["workspaces"] }); select(workspace.id); setWorkspaceDialog(null); setWorkspaceError(""); },
  });
  const updateWorkspace = useMutation({
    mutationFn: () => api.updateWorkspace(activeWorkspace!.id, { name: workspaceName.trim(), slug: workspaceSlug.trim(), description: workspaceDescription.trim() || null }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ["workspaces"] }); setWorkspaceDialog(null); setWorkspaceError(""); },
  });

  useEffect(() => {
    const syncTheme = () => {
      const enabled = localStorage.getItem("teamspace-theme") !== "light";
      setDark(enabled); document.documentElement.classList.toggle("orbit-light", !enabled);
    };
    syncTheme();
    window.addEventListener("teamspace-theme-change", syncTheme);
    setSidebarCollapsed(localStorage.getItem("teamspace-sidebar-collapsed") === "true");
    return () => window.removeEventListener("teamspace-theme-change", syncTheme);
  }, []);
  function openWorkspaceDialog(mode: "create" | "edit") {
    setWorkspaceError(""); createWorkspace.reset(); updateWorkspace.reset();
    if (mode === "edit" && activeWorkspace) {
      setWorkspaceName(activeWorkspace.name); setWorkspaceSlug(activeWorkspace.slug); setWorkspaceDescription(activeWorkspace.description ?? "");
    } else { setWorkspaceName(""); setWorkspaceSlug(""); setWorkspaceDescription(""); }
    setWorkspaceDialog(mode);
  }
  function submitWorkspace(event: FormEvent) {
    event.preventDefault();
    if (!/^[a-z0-9-]{2,100}$/.test(workspaceSlug.trim())) { setWorkspaceError("Use 2–100 lowercase letters, numbers, or hyphens for the workspace slug."); return; }
    setWorkspaceError("");
    if (workspaceDialog === "create") createWorkspace.mutate(); else updateWorkspace.mutate();
  }
  function toggleTheme() {
    const next = !dark; setDark(next); document.documentElement.classList.toggle("orbit-light", !next);
    localStorage.setItem("teamspace-theme", next ? "dark" : "light");
  }
  function toggleSidebar() {
    const next = !sidebarCollapsed; setSidebarCollapsed(next);
    localStorage.setItem("teamspace-sidebar-collapsed", String(next));
  }
  function signOut() { clear(); select(null); router.push("/login"); }

  const navLink = ({ href, label, icon: Icon }: (typeof primaryNav)[number]) => {
    const active = pathname === href;
    return <Link key={href} href={href} title={sidebarCollapsed ? label : undefined} aria-current={active ? "page" : undefined} className={`sidebar-link group relative flex items-center rounded-[13px] py-2.5 text-[12px] font-medium transition-all duration-300 ${sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"} ${active ? "sidebar-link-active text-white" : "text-white/50 hover:bg-white/[.045] hover:text-white/85"}`}>
      {active && <span className="sidebar-active-rail"/>}<span className={`grid size-8 shrink-0 place-items-center rounded-[10px] transition-all duration-300 ${active ? "bg-[#9b85ff]/15 text-[#c0b1ff] shadow-[inset_0_0_0_1px_rgba(174,153,255,.14)]" : "text-white/40 group-hover:bg-white/[.05] group-hover:text-white/80"}`}><Icon size={16} strokeWidth={active ? 2.15 : 1.75}/></span>{!sidebarCollapsed && <><span className="min-w-0 flex-1 truncate">{label}</span>{href === "/notifications" && !!unread.data?.unread_count && <span className="grid min-w-5 place-items-center rounded-full border border-[#a996ff]/20 bg-[#7659f6]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#c3b7ff]">{unread.data.unread_count}</span>}</>}{sidebarCollapsed && href === "/notifications" && !!unread.data?.unread_count && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#b5a2ff] shadow-[0_0_10px_rgba(181,162,255,.8)]"/>}
    </Link>;
  };

  if (pathname === "/login") return <>{children}</>;

  return <div className="orbit-world relative min-h-screen text-white md:flex">
    <div aria-hidden="true" className="orbit-backdrop"><div className="orbit-mesh"/><div className="orbit-glow orbit-glow-a"/><div className="orbit-glow orbit-glow-b"/><div className="orbit-glow orbit-glow-c"/></div>
    <aside className={`orbit-sidebar sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-white/[.06] bg-[#101119]/90 py-5 text-white shadow-[16px_0_60px_rgba(0,0,0,.12)] backdrop-blur-2xl transition-[width,padding] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] md:flex ${sidebarCollapsed ? "w-[84px] px-3" : "w-[266px] px-4"}`}>
      <div aria-hidden="true" className="sidebar-aura"/>
      <div className={`relative mb-7 flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between px-1"}`}>
        <Link href="/" title="Orbit overview" className={`group flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}>
          <span className="brand-mark relative grid size-10 shrink-0 place-items-center rounded-[15px] bg-gradient-to-br from-[#a08cff] via-[#7559f6] to-[#5941ce] shadow-[0_6px_24px_rgba(118,89,246,.34)]"><span className="absolute inset-[1px] rounded-[14px] border border-white/20"/><Command size={18} className="relative text-white transition-transform duration-500 group-hover:rotate-[-12deg] group-hover:scale-110"/></span>
          {!sidebarCollapsed && <span className="overflow-hidden whitespace-nowrap"><span className="block text-[15px] font-semibold tracking-[-.04em]">orbit<span className="text-[#ad9cff]">.</span></span><span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[.22em] text-white/30">work in motion</span></span>}
        </Link>
        {!sidebarCollapsed && <button onClick={toggleSidebar} aria-label="Collapse sidebar" title="Collapse sidebar" className="grid size-8 place-items-center rounded-lg text-white/30 transition hover:bg-white/[.07] hover:text-white/80"><PanelLeftClose size={15}/></button>}
      </div>
      {sidebarCollapsed && <button onClick={toggleSidebar} aria-label="Expand sidebar" title="Expand sidebar" className="absolute right-[-13px] top-[29px] z-10 grid size-[27px] place-items-center rounded-full border border-white/10 bg-[#292735] text-white/55 shadow-xl transition hover:scale-110 hover:border-[#aa97ff]/50 hover:text-[#c7baff]"><PanelLeftOpen size={13}/></button>}

      <section aria-label="Workspace switcher" className={`sidebar-workspace relative mb-7 overflow-hidden rounded-[19px] border border-white/[.09] bg-gradient-to-br from-[#242238] via-[#191a27] to-[#151620] shadow-[0_12px_30px_rgba(0,0,0,.18),inset_0_1px_rgba(255,255,255,.07)] transition-all duration-300 ${sidebarCollapsed ? "p-2" : "p-3"}`}>
        <div className={`sidebar-workspace-orbit ${sidebarCollapsed ? "sidebar-workspace-orbit-small" : ""}`} aria-hidden="true"/>
        {!sidebarCollapsed ? <>
          <div className="relative mb-2 flex items-center justify-between px-0.5"><span className="text-[8px] font-bold uppercase tracking-[.19em] text-white/42">Workspace</span>{canManage && <button type="button" onClick={() => openWorkspaceDialog("edit")} aria-label="Edit current workspace" title="Edit workspace details" className="grid size-6 place-items-center rounded-md text-white/35 transition hover:bg-white/[.08] hover:text-white"><Pencil size={11}/></button>}</div>
          <label className="sidebar-current-workspace relative flex items-center gap-2.5 rounded-[13px] border border-white/[.07] bg-black/15 px-2.5 py-2.5 transition hover:border-[#ab98ff]/25 hover:bg-black/20">
            <span className="workspace-monogram grid size-9 shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-[#aa98ff] to-[#7254ed] text-[10px] font-extrabold tracking-wide text-white shadow-[0_4px_14px_rgba(119,89,246,.28)]">{workspaceMonogram(activeWorkspace?.name)}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-white/90">{activeWorkspace?.name ?? "Choose workspace"}</span><span className="mt-0.5 block truncate text-[8px] text-white/38">{activeWorkspace?.slug ?? "No workspace selected"}</span></span>
            <ChevronDown size={13} className="shrink-0 text-white/35"/>
            <select aria-label="Select workspace" value={selectedId ?? activeWorkspace?.id ?? ""} onChange={(event) => select(event.target.value || null)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">{workspaces.data?.length ? workspaces.data.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>) : <option value="">Your workspace</option>}</select>
          </label>
          <button type="button" onClick={() => openWorkspaceDialog("create")} className="sidebar-create-workspace group relative mt-2.5 flex w-full items-center gap-2.5 overflow-hidden rounded-[13px] border border-[#a995ff]/25 bg-gradient-to-r from-[#8065f2]/20 via-[#7059df]/10 to-transparent px-2.5 py-2.5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-[#b7a7ff]/45 hover:from-[#8065f2]/30 hover:via-[#7059df]/15 hover:to-[#60d5b0]/[.08]"><span className="grid size-8 shrink-0 place-items-center rounded-[10px] border border-[#b5a4ff]/20 bg-[#8b75f7]/15 text-[#c5b8ff] transition group-hover:rotate-90 group-hover:bg-[#8b75f7]/25"><Plus size={15}/></span><span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold text-white/85">Create workspace</span><span className="mt-0.5 block text-[8px] text-white/38">Start a new team space</span></span><ArrowUpRight size={12} className="shrink-0 text-white/25 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#c5b8ff]"/></button>
        </> : <>
          <label title={activeWorkspace?.name ?? "Select workspace"} className="sidebar-current-workspace relative mx-auto grid size-10 cursor-pointer place-items-center rounded-[13px] border border-white/[.09] bg-black/15 transition hover:border-[#ab98ff]/35"><span className="workspace-monogram grid size-9 place-items-center rounded-[11px] bg-gradient-to-br from-[#aa98ff] to-[#7254ed] text-[10px] font-extrabold text-white">{workspaceMonogram(activeWorkspace?.name)}</span><select aria-label="Select workspace" value={selectedId ?? activeWorkspace?.id ?? ""} onChange={(event) => select(event.target.value || null)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">{workspaces.data?.length ? workspaces.data.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>) : <option value="">Your workspace</option>}</select></label>
          <div className="mt-2 flex justify-center gap-1"><button type="button" onClick={() => openWorkspaceDialog("create")} aria-label="Create workspace" title="Create workspace" className="grid size-8 place-items-center rounded-[10px] border border-[#a995ff]/20 bg-[#8065f2]/10 text-[#c5b8ff] transition hover:bg-[#8065f2]/25"><Plus size={14}/></button>{canManage && <button type="button" onClick={() => openWorkspaceDialog("edit")} aria-label="Edit current workspace" title="Edit workspace" className="grid size-8 place-items-center rounded-[10px] text-white/35 transition hover:bg-white/[.07] hover:text-white"><Pencil size={12}/></button>}</div>
        </>}
      </section>

      <div className="relative mb-2 flex items-center justify-between px-3">{!sidebarCollapsed && <p className="text-[8px] font-bold uppercase tracking-[.2em] text-white/28">Navigate</p>}<span className={`${sidebarCollapsed ? "mx-auto" : ""} text-[8px] font-medium text-white/20`}>01</span></div>
      <nav aria-label="Workspace navigation" className="relative space-y-1">{primaryNav.map(navLink)}</nav>
      <div className={`relative mb-2 mt-7 flex items-center justify-between px-3`}>{!sidebarCollapsed && <p className="text-[8px] font-bold uppercase tracking-[.2em] text-white/28">Team space</p>}<span className={`${sidebarCollapsed ? "mx-auto" : ""} text-[8px] font-medium text-white/20`}>02</span></div>
      <nav aria-label="Team navigation" className="relative space-y-1">{teamNav.map(navLink)}</nav>
      <div className={`relative mt-auto overflow-hidden rounded-[17px] border border-white/[.08] bg-gradient-to-br from-white/[.055] to-white/[.02] transition-all duration-300 ${sidebarCollapsed ? "p-2" : "p-3"}`}>
        <div className={`flex items-center ${sidebarCollapsed ? "flex-col gap-2" : "gap-3"}`}><div className="profile-avatar grid size-9 shrink-0 place-items-center rounded-[13px] bg-gradient-to-br from-[#e5dfff] via-[#cfc3ff] to-[#9f8aff] text-[10px] font-extrabold text-[#3f327f] shadow-[0_4px_16px_rgba(147,123,255,.15)]">{user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2) ?? "YO"}</div>{!sidebarCollapsed && <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold text-white/90">{user?.name ?? "Welcome"}</div><div className="mt-0.5 truncate text-[9px] text-white/38">{user?.email ?? "Sign in to continue"}</div></div>}<button onClick={signOut} aria-label="Sign out" title="Sign out" className="grid size-8 shrink-0 place-items-center rounded-[10px] text-white/35 transition hover:bg-[#ff7272]/10 hover:text-[#ff9898]"><LogOut size={14}/></button></div>
        {!sidebarCollapsed && <div className="mt-3 flex items-center justify-between border-t border-white/[.07] pt-2.5"><span className="flex items-center gap-1.5 text-[8px] text-white/28"><span className="size-1.5 rounded-full bg-[#5bcfa7] shadow-[0_0_8px_rgba(91,207,167,.8)]"/>Connected</span><Link href="/settings" className={`rounded-md px-2 py-1 text-[9px] font-medium transition hover:bg-white/[.055] hover:text-white/70 ${pathname === "/settings" ? "text-[#c2b5ff]" : "text-white/35"}`}><Settings2 size={11} className="mr-1 inline"/>Settings</Link></div>}
      </div>
    </aside>

    <main className="relative z-10 min-h-screen min-w-0 flex-1">
      <header className="sticky top-0 z-20 border-b border-white/[.07] bg-[#0b0c13]/75 text-white backdrop-blur-2xl">
        <div className="flex h-[68px] items-center justify-between px-5 md:px-9">
          <div className="flex min-w-0 items-center gap-2"><span className="hidden text-[10px] font-medium tracking-wide text-white/35 sm:inline">{activeWorkspace?.name ?? "Workspace"}</span><span className="hidden text-white/20 sm:inline">/</span><h1 className="truncate text-[12px] font-semibold text-white/85">{pageName[pathname] ?? "Overview"}</h1></div>
          <div className="flex items-center gap-2"><span className="mr-1 hidden items-center gap-1.5 rounded-full border border-white/[.08] bg-white/[.025] px-2.5 py-1.5 text-[9px] font-medium text-white/50 sm:inline-flex"><span className="relative size-1.5 rounded-full bg-[#63d3a8] before:absolute before:-inset-1 before:animate-ping before:rounded-full before:bg-[#63d3a8]/30"/>All systems normal</span><button onClick={toggleTheme} aria-label="Toggle light mode" className="grid size-9 place-items-center rounded-xl border border-white/[.08] text-white/55 transition hover:bg-white/[.07] hover:text-white">{dark ? <Sun size={15}/> : <Moon size={15}/>}</button><button onClick={() => router.push("/notifications")} aria-label="Open notifications" className="relative grid size-9 place-items-center rounded-xl border border-white/[.08] text-white/55 transition hover:bg-white/[.07] hover:text-white"><Bell size={15}/>{!!unread.data?.unread_count && <span className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-[#0b0c13] bg-[#a996ff]"/>}</button><div className="ml-1 grid size-8 place-items-center rounded-full bg-gradient-to-br from-[#dcd5ff] to-[#a997ff] text-[10px] font-bold text-[#35266e] md:hidden">{user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div></div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">{[...primaryNav, ...teamNav].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium ${pathname === href ? "bg-white/[.1] text-[#c9beff]" : "text-white/50 hover:bg-white/[.05]"}`}><Icon size={13}/>{label}</Link>)}</nav>
      </header>
      <div className="mx-auto max-w-[1500px] p-5 md:p-8 lg:p-9">{children}</div>
    </main>

    {workspaceDialog && <div className="fixed inset-0 z-50 grid place-items-center bg-[#10111a]/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setWorkspaceDialog(null); }}><form onSubmit={submitWorkspace} className="w-full max-w-md rounded-[24px] border border-white/60 bg-white p-6 shadow-[0_24px_80px_rgba(18,20,34,.22)]"><div className="flex items-start justify-between"><div><span className="grid size-10 place-items-center rounded-xl bg-[#eeeaff] text-[#694fe9]"><Plus size={18}/></span><h2 className="mt-4 text-lg font-semibold">{workspaceDialog === "create" ? "Create a workspace" : "Edit workspace"}</h2><p className="mt-1 text-sm text-[#777b8a]">{workspaceDialog === "create" ? "A dedicated home for another team or organization." : "Keep your workspace details up to date."}</p></div><button type="button" onClick={() => setWorkspaceDialog(null)} aria-label="Close dialog" className="grid size-8 place-items-center rounded-lg text-[#858897] hover:bg-[#f3f3f7]"><X size={16}/></button></div><label className="mt-5 block text-[12px] font-semibold">Workspace name<input autoFocus required maxLength={160} value={workspaceName} onChange={(event) => { const value = event.target.value; setWorkspaceName(value); if (workspaceDialog === "create") setWorkspaceSlug(value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} className="mt-2 h-11 w-full rounded-xl border border-[#e5e6ed] bg-[#fbfbfd] px-3.5 text-[13px] outline-none transition focus:border-[#8a75f5] focus:ring-4 focus:ring-[#7659f6]/10" placeholder="Platform team"/></label><label className="mt-4 block text-[12px] font-semibold">Workspace slug<input required minLength={2} maxLength={100} pattern="[a-z0-9-]+" value={workspaceSlug} onChange={(event) => setWorkspaceSlug(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#e5e6ed] bg-[#fbfbfd] px-3.5 text-[13px] outline-none transition focus:border-[#8a75f5] focus:ring-4 focus:ring-[#7659f6]/10" placeholder="platform-team"/></label><label className="mt-4 block text-[12px] font-semibold">Description <span className="font-normal text-[#9295a3]">· optional</span><textarea maxLength={2000} value={workspaceDescription} onChange={(event) => setWorkspaceDescription(event.target.value)} rows={3} className="mt-2 w-full resize-y rounded-xl border border-[#e5e6ed] bg-[#fbfbfd] px-3.5 py-2.5 text-[13px] outline-none transition focus:border-[#8a75f5] focus:ring-4 focus:ring-[#7659f6]/10" placeholder="What this workspace is for"/></label>{(workspaceError || createWorkspace.error || updateWorkspace.error) && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-[12px] text-red-700">{workspaceError || createWorkspace.error?.message || updateWorkspace.error?.message}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setWorkspaceDialog(null)} className="h-10 rounded-xl px-4 text-[12px] font-semibold text-[#777b8a] hover:bg-[#f4f4f8]">Cancel</button><button disabled={createWorkspace.isPending || updateWorkspace.isPending} className="h-10 rounded-xl bg-[#6a50e8] px-4 text-[12px] font-semibold text-white shadow-[0_6px_16px_rgba(106,80,232,.22)] transition hover:bg-[#5d44d5] disabled:opacity-50">{createWorkspace.isPending || updateWorkspace.isPending ? "Saving…" : workspaceDialog === "create" ? "Create workspace" : "Save changes"}</button></div></form></div>}
  </div>;
}
