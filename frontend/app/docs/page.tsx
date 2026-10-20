"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, ChevronRight, Clock3, Download, FilePlus2, FileText, History, List, Plus, Quote, Save, Search, Sparkles, Trash2, Type, Upload, X } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { api } from "@/lib/api";
import type { WikiVersion } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { useWorkspace } from "@/store/workspace";
import "./docs.css";

const shortDate = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
const fileSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function DocsPage() {
  const selectedWorkspaceId = useWorkspace(state => state.selectedId);
  const user = useAuth(state => state.user);
  const client = useQueryClient();
  const workspaceList = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces, enabled: !!user });
  const workspaceId = selectedWorkspaceId ?? workspaceList.data?.[0]?.id ?? null;
  const [pageId, setPageId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<WikiVersion | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [docToArchive, setDocToArchive] = useState<{ id: string; title: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const docs = useQuery({ queryKey: ["docs", workspaceId], queryFn: () => api.docs(workspaceId!), enabled: !!workspaceId });
  const files = useQuery({ queryKey: ["workspace-files", workspaceId], queryFn: () => api.workspaceFiles(workspaceId!), enabled: !!workspaceId });
  const members = useQuery({ queryKey: ["members", workspaceId], queryFn: () => api.members(workspaceId!), enabled: !!workspaceId });
  useEffect(() => {
    if (!docs.data?.length) { setPageId(null); return; }
    if (!pageId || !docs.data.some(page => page.id === pageId)) setPageId(docs.data[0].id);
  }, [docs.data, pageId]);
  const currentPage = useQuery({ queryKey: ["doc", pageId], queryFn: () => api.doc(pageId!), enabled: !!pageId });
  const versions = useQuery({ queryKey: ["doc-versions", pageId], queryFn: () => api.docVersions(pageId!), enabled: !!pageId && historyOpen });
  useEffect(() => {
    if (currentPage.data) { setDraftTitle(currentPage.data.title); setDraftContent(currentPage.data.content); setSelectedVersion(null); }
  }, [currentPage.data?.id, currentPage.data?.updated_at]);
  const visibleDocs = useMemo(() => (docs.data ?? []).filter(page => page.title.toLowerCase().includes(search.toLowerCase())), [docs.data, search]);
  const workspaceRole = members.data?.find(member => member.user_id === user?.id)?.role;
  const mayEdit = ["owner", "admin", "member"].includes(workspaceRole ?? "");
  const uploadFile = useMutation({
    mutationFn: (file: File) => api.uploadWorkspaceFile(workspaceId!, file),
    onSuccess: async () => { setFileError(null); await client.invalidateQueries({ queryKey: ["workspace-files", workspaceId] }); },
    onError: error => setFileError(error.message),
  });
  const removeFile = useMutation({
    mutationFn: (id: string) => api.deleteWorkspaceFile(id),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["workspace-files", workspaceId] }); },
  });
  const downloadFile = useMutation({
    mutationFn: async ({ id, filename }: { id: string; filename: string }) => ({ blob: await api.downloadWorkspaceFile(id), filename }),
    onSuccess: ({ blob, filename }) => { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); },
  });
  const canArchiveDoc = (page: NonNullable<typeof docs.data>[number]) =>
    page.created_by === user?.id || ["owner", "admin"].includes(workspaceRole ?? "");
  useEffect(() => { if (workspaceRole === "guest") setMode("preview"); }, [workspaceRole]);

  const createDoc = useMutation({
    mutationFn: () => api.createDoc(workspaceId!, { title: newTitle.trim(), content: `# ${newTitle.trim()}\n\n` + "Write your notes here…", parent_page_id: newParentId }),
    onSuccess: async page => { await client.invalidateQueries({ queryKey: ["docs", workspaceId] }); setPageId(page.id); setNewTitle(""); setNewParentId(null); setCreateDialog(false); setMode("edit"); },
  });
  const saveDoc = useMutation({
    mutationFn: () => api.updateDoc(pageId!, { title: draftTitle.trim(), content: draftContent, change_summary: changeSummary.trim() || undefined }),
    onSuccess: async page => { setChangeSummary(""); setSelectedVersion(null); client.setQueryData(["doc", page.id], page); await client.invalidateQueries({ queryKey: ["docs", workspaceId] }); await client.invalidateQueries({ queryKey: ["doc-versions", page.id] }); },
  });
  const archiveDoc = useMutation({
    mutationFn: (id: string) => api.archiveDoc(id),
    onSuccess: async (_result, id) => {
      client.setQueryData<typeof docs.data>(["docs", workspaceId], current => current?.filter(page => page.id !== id));
      client.removeQueries({ queryKey: ["doc", id] });
      if (pageId === id) {
        setPageId(null);
        setSelectedVersion(null);
      }
      setDocToArchive(null);
      await client.invalidateQueries({ queryKey: ["docs", workspaceId] });
    },
  });
  useEffect(() => {
    if (!docToArchive || archiveDoc.isPending) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDocToArchive(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [docToArchive, archiveDoc.isPending]);
  function openCreate(parentId: string | null = null) { setNewParentId(parentId); setNewTitle(""); createDoc.reset(); setCreateDialog(true); }
  function submitCreate(event: FormEvent) { event.preventDefault(); if (newTitle.trim()) createDoc.mutate(); }
  function insertMarkdown(value: string) { setDraftContent(content => `${content}${content && !content.endsWith("\n") ? "\n" : ""}\n${value}`); }
  function showVersion(version: WikiVersion) { setSelectedVersion(version); setMode("preview"); }

  const displayTitle = selectedVersion?.title ?? currentPage.data?.title ?? "";
  const displayContent = selectedVersion?.content ?? draftContent;

  return <div className="collab-page docs-page">
    <section className="collab-hero docs-hero"><div className="collab-hero-orbit"/><div className="collab-kicker"><span className="collab-kicker-dot"/> TEAM KNOWLEDGE</div><div className="mt-4 flex flex-wrap items-end justify-between gap-5"><div><h1>One home for how work gets done.</h1><p>Capture decisions, onboarding notes, and the little details teams should not have to rediscover.</p></div><div className="docs-hero-mark"><BookOpen size={17}/><span><strong>Team handbook</strong><small>Shared, searchable, versioned</small></span></div></div></section>

    {!workspaceId ? <div className="collab-empty">Choose a workspace to open team docs.</div> : <section className="docs-workspace">
      <aside className="docs-sidebar collab-panel">
        <div className="docs-sidebar-heading"><div><span className="collab-overline">WORKSPACE LIBRARY</span><h2>Team docs</h2></div><button onClick={() => openCreate(null)} title="Create document" aria-label="Create document" className="channel-add"><Plus size={15}/></button></div>
        <label className="docs-search"><Search size={13}/><input aria-label="Search documents" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a page"/></label>
        <div className="docs-list-label"><span>ALL PAGES</span><span>{visibleDocs.length}</span></div>
        <div className="docs-tree">
          {docs.isLoading && <p className="docs-list-empty">Loading pages…</p>}
          {docs.error && <p role="alert" className="docs-list-empty docs-error">{docs.error.message}</p>}
          {visibleDocs.map(page => <div key={page.id} className={`docs-tree-row ${page.parent_page_id ? "docs-tree-child" : ""}`}>
            <button onClick={() => { setPageId(page.id); setMode("edit"); setSelectedVersion(null); }} className={`docs-tree-item ${page.id === pageId ? "docs-tree-active" : ""}`}><span className="docs-page-icon">{page.icon || "▤"}</span><span className="truncate">{page.title}</span><ChevronRight size={12} className="ml-auto opacity-35"/></button>
            {canArchiveDoc(page) && <button type="button" className="docs-archive-button" title={`Archive ${page.title}`} aria-label={`Archive document ${page.title}`} disabled={archiveDoc.isPending} onClick={() => {
              archiveDoc.reset();
              setDocToArchive({ id: page.id, title: page.title });
            }}><Trash2 size={13}/></button>}
          </div>)}
          {archiveDoc.error && <p role="alert" className="docs-list-empty docs-error">{archiveDoc.error.message}</p>}
          {!docs.isLoading && !docs.error && visibleDocs.length === 0 && <div className="docs-list-empty"><FilePlus2 size={17}/><span>{search ? "No pages match your search." : "Your team library is ready for its first page."}</span></div>}
        </div>
        <div className="docs-files-heading"><span>FILES</span><span>{files.data?.length ?? 0}</span></div>
        <div className="docs-files-list">
          {files.isLoading && <p className="docs-files-empty">Loading files…</p>}
          {files.error && <p role="alert" className="docs-files-empty docs-error">{files.error.message}</p>}
          {files.data?.map(file => <div key={file.id} className="docs-file-row">
            <FileText size={13}/><span className="docs-file-info"><strong title={file.filename}>{file.filename}</strong><small>{fileSize(file.size_bytes)}</small></span>
            <button type="button" title={`Download ${file.filename}`} aria-label={`Download ${file.filename}`} onClick={() => downloadFile.mutate({ id: file.id, filename: file.filename })} disabled={downloadFile.isPending}><Download size={12}/></button>
            {(file.uploaded_by === user?.id || ["owner", "admin"].includes(workspaceRole ?? "")) && <button type="button" title={`Remove ${file.filename}`} aria-label={`Remove ${file.filename}`} onClick={() => removeFile.mutate(file.id)} disabled={removeFile.isPending}><Trash2 size={12}/></button>}
          </div>)}
          {!files.isLoading && !files.error && !files.data?.length && <p className="docs-files-empty">Shared documents will appear here.</p>}
          {(fileError || removeFile.error || downloadFile.error) && <p role="alert" className="docs-files-empty docs-error">{fileError || removeFile.error?.message || downloadFile.error?.message}</p>}
        </div>
        <label className={`docs-upload-button ${!mayEdit || uploadFile.isPending ? "docs-upload-disabled" : ""}`}>
          <Upload size={13}/>{uploadFile.isPending ? "Uploading…" : "Upload a file"}
          <input type="file" accept=".pdf,.doc,.docx,.odt,.rtf,.txt,.md,.csv,.xls,.xlsx,.ods,.ppt,.pptx,.odp" disabled={!mayEdit || uploadFile.isPending} onChange={event => { const file = event.currentTarget.files?.[0]; if (file) uploadFile.mutate(file); event.currentTarget.value = ""; }}/>
        </label>
        <button onClick={() => openCreate(pageId)} disabled={!pageId} className="docs-add-subpage"><Plus size={13}/> New subpage</button>
        <div className="docs-sidebar-foot"><Sparkles size={13}/><span>Good notes make good handoffs.</span></div>
      </aside>

      <main className="docs-editor collab-panel">
        {currentPage.data ? <>
          <div className="docs-toolbar"><div className="docs-breadcrumb"><BookOpen size={12}/><span>Team docs</span><ChevronRight size={11}/><strong>{displayTitle || "Untitled"}</strong>{selectedVersion && <span className="docs-version-pill">v{selectedVersion.version_number}</span>}</div><div className="docs-toolbar-actions"><button onClick={() => setHistoryOpen(open => !open)} className={`docs-tool-button ${historyOpen ? "docs-tool-active" : ""}`} title="Version history"><History size={14}/><span>History</span></button>{!selectedVersion && <><div className="docs-mode-switch"><button onClick={() => setMode("edit")} className={mode === "edit" ? "selected" : ""}>Write</button><button onClick={() => setMode("preview")} className={mode === "preview" ? "selected" : ""}>Preview</button></div>{mayEdit && <button disabled={!draftTitle.trim() || saveDoc.isPending || (draftTitle === currentPage.data.title && draftContent === currentPage.data.content)} onClick={() => saveDoc.mutate()} className="docs-save"><Save size={13}/>{saveDoc.isPending ? "Saving…" : "Save"}</button>}</>}</div></div>
          <div className="docs-content-columns">
            <div className="docs-writing-area">
              <div className="docs-page-meta"><span><Clock3 size={12}/> Edited {shortDate(currentPage.data.updated_at)}</span>{currentPage.data.updated_by === user?.id && <span className="docs-you-label">YOU</span>}<button onClick={() => openCreate(currentPage.data!.id)} className="docs-add-child"><Plus size={12}/> Add subpage</button></div>
              {selectedVersion ? <div className="docs-old-version"><History size={13}/> Viewing version {selectedVersion.version_number}{selectedVersion.change_summary ? ` · ${selectedVersion.change_summary}` : ""}<button onClick={() => { setSelectedVersion(null); setMode("edit"); }}><X size={12}/> Return to current</button></div> : <input aria-label="Page title" className="docs-title-input" value={draftTitle} onChange={event => setDraftTitle(event.target.value)} disabled={mode === "preview"} placeholder="Untitled"/>}
              {!selectedVersion && mode === "edit" && mayEdit && <div className="docs-format-toolbar"><span>FORMAT</span><button type="button" title="Heading" onClick={() => insertMarkdown("## Heading")}><Type size={14}/><b>H</b></button><button type="button" title="Bullet list" onClick={() => insertMarkdown("- List item")}><List size={14}/></button><button type="button" title="Quote" onClick={() => insertMarkdown("> A useful thought")}><Quote size={14}/></button><button type="button" title="Checklist" onClick={() => insertMarkdown("- [ ] Action item")}><Check size={14}/></button><span className="docs-markdown-hint">Markdown</span></div>}
              {mode === "edit" && !selectedVersion && mayEdit ? <><textarea aria-label="Document Markdown" className="docs-textarea" value={draftContent} onChange={event => setDraftContent(event.target.value)} placeholder="Start with an idea, a decision, or a checklist…"/><div className="docs-save-row"><input aria-label="Version note" value={changeSummary} onChange={event => setChangeSummary(event.target.value)} placeholder="Add a note to this version (optional)"/>{saveDoc.error && <span role="alert" className="docs-error">{saveDoc.error.message}</span>}</div></> : <article className="docs-preview"><Markdown content={displayContent || "_This page is empty. Select Write to add content._"}/></article>}
            </div>
            {historyOpen && <aside className="docs-history"><div className="docs-history-heading"><History size={13}/><span>PAGE HISTORY</span></div>{versions.isLoading && <p className="docs-history-empty">Loading versions…</p>}{versions.error && <p role="alert" className="docs-history-empty docs-error">{versions.error.message}</p>}{versions.data?.map(version => <button key={version.id} onClick={() => showVersion(version)} className={`docs-version ${selectedVersion?.id === version.id ? "docs-version-active" : ""}`}><span className="docs-version-marker"/><span className="min-w-0"><strong>Version {version.version_number}{version.version_number === versions.data?.[0]?.version_number ? " · latest" : ""}</strong><small>{version.change_summary || "Saved changes"}</small><small>{shortDate(version.created_at)}</small></span></button>)}{!versions.data?.length && !versions.isLoading && <p className="docs-history-empty">Saved snapshots appear here.</p>}</aside>}
          </div>
        </> : <div className="docs-empty-state"><span><BookOpen size={21}/></span><h2>Your team knowledge starts here.</h2><p>Create a page for onboarding, team agreements, meeting notes, or project context.</p><button onClick={() => openCreate(null)} className="collab-primary"><Plus size={14}/> Create your first page</button></div>}
      </main>
    </section>}

    {createDialog && <div className="collab-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setCreateDialog(false); }}><form onSubmit={submitCreate} className="collab-modal"><div className="flex items-start justify-between"><div><span className="collab-modal-icon"><FilePlus2 size={17}/></span><h2 className="mt-4 text-lg font-semibold text-ink">Create a page</h2><p className="mt-1 text-sm text-muted">Start a new page in your shared team library.</p></div><button type="button" onClick={() => setCreateDialog(false)} aria-label="Close" className="channel-add"><X size={15}/></button></div><label className="collab-label">Page title<input autoFocus required maxLength={200} value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="Team working agreements"/></label>{newParentId && <p className="docs-parent-note">This page will be nested under {docs.data?.find(page => page.id === newParentId)?.title ?? "the selected page"}.</p>}{createDoc.error && <p role="alert" className="mt-3 text-xs text-red-500">{createDoc.error.message}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCreateDialog(false)} className="channel-cancel">Cancel</button><button disabled={!newTitle.trim() || createDoc.isPending} className="collab-primary">{createDoc.isPending ? "Creating…" : "Create page"}</button></div></form></div>}
    {docToArchive && <div className="collab-modal-backdrop archive-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !archiveDoc.isPending) setDocToArchive(null); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="archive-doc-title" aria-describedby="archive-doc-description" className="collab-modal archive-confirm-modal">
        <div className="archive-confirm-heading">
          <span className="archive-confirm-icon"><Trash2 size={17}/></span>
          <span className="archive-confirm-label">DOCUMENT ARCHIVE</span>
        </div>
        <h2 id="archive-doc-title" className="archive-confirm-title">Archive <span>“{docToArchive.title}”</span>?</h2>
        <p id="archive-doc-description" className="archive-confirm-description">This document will be removed from the team library and won’t appear in the docs list.</p>
        {archiveDoc.error && <p role="alert" className="archive-confirm-error">{archiveDoc.error.message}</p>}
        <div className="archive-confirm-actions">
          <button type="button" className="channel-cancel" disabled={archiveDoc.isPending} onClick={() => setDocToArchive(null)}>Keep document</button>
          <button type="button" className="archive-confirm-submit" disabled={archiveDoc.isPending} autoFocus onClick={() => archiveDoc.mutate(docToArchive.id)}>{archiveDoc.isPending ? "Archiving…" : "Archive document"}</button>
        </div>
      </section>
    </div>}
  </div>;
}
