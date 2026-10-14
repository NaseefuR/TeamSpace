"use client";

import "./ai.css";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  Layers3,
  MessageSquareText,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  WandSparkles,
  X,
} from "lucide-react";
import { Markdown } from "@/components/markdown";
import { api } from "@/lib/api";
import type { AIAnswer } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { useWorkspace } from "@/store/workspace";

type Message = { question: string; result?: AIAnswer; error?: string };
const prompts = [
  { icon: UserRound, label: "My tasks", question: "What tasks are assigned to me?", tint: "mint" },
  { icon: UsersRound, label: "Team assignments", question: "Who is each task assigned to?", tint: "violet" },
  { icon: Clock3, label: "Work in motion", question: "What work is currently in progress?", tint: "mint" },
  { icon: CircleHelp, label: "Risks & priorities", question: "Which tasks are high priority or overdue?", tint: "amber" },
  { icon: Layers3, label: "Project overview", question: "Summarize the active projects.", tint: "violet" },
];

export default function AIPage() {
  const router = useRouter();
  const user = useAuth(state => state.user);
  const workspaceId = useWorkspace(state => state.selectedId);
  const [question, setQuestion] = useState("");
  const [projectId, setProjectId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const activeWorkspaceId = useRef<string | undefined>(undefined);

  useEffect(() => { if (!useAuth.getState().tokens) router.replace("/login"); }, [router]);

  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces, enabled: !!user });
  const workspace = workspaces.data?.find(item => item.id === workspaceId) ?? workspaces.data?.[0];
  activeWorkspaceId.current = workspace?.id;
  const projects = useQuery({ queryKey: ["projects", workspace?.id], queryFn: () => api.projects(workspace!.id), enabled: !!workspace });
  const selectedProject = projects.data?.find(project => project.id === projectId);
  const ask = useMutation({
    mutationFn: (request: { text: string; workspaceId: string; projectId?: string }) => api.askAI(request.workspaceId, request.text, request.projectId),
    onSuccess: (result, request) => { if (activeWorkspaceId.current === request.workspaceId) setMessages(current => [...current, { question: request.text, result }]); },
    onError: (error, request) => { if (activeWorkspaceId.current === request.workspaceId) setMessages(current => [...current, { question: request.text, error: error.message }]); },
  });

  useEffect(() => { setProjectId(""); setMessages([]); setQuestion(""); }, [workspace?.id]);
  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTo({ top: transcript.scrollHeight, behavior: "smooth" });
  }, [messages, ask.isPending]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || !workspace || ask.isPending) return;
    const scopedProjectId = projects.data?.some(project => project.id === projectId) ? projectId : undefined;
    setQuestion(""); ask.mutate({ text, workspaceId: workspace.id, projectId: scopedProjectId });
  }

  function startNewConversation() { setMessages([]); setQuestion(""); ask.reset(); }
  function usePrompt(prompt: string) { setQuestion(prompt); }

  const answerCount = messages.filter(message => !!message.result).length;
  const scopeLabel = selectedProject ? selectedProject.name : "All workspace projects";

  return <>
    <div className="ai-page">
      <section className="ai-hero bento-enter">
        <div className="ai-hero-grid" aria-hidden="true"/>
        <div className="ai-hero-orbit ai-hero-orbit-one" aria-hidden="true"/>
        <div className="ai-hero-orbit ai-hero-orbit-two" aria-hidden="true"/>
        <div className="ai-hero-copy">
          <div className="ai-eyebrow"><span><WandSparkles size={13}/></span> TEAM INTELLIGENCE <i/> ASK WITH CONTEXT</div>
          <h1>AI assistant<span>.</span></h1>
          <p>Get a grounded read on your team’s work, projects, and priorities.</p>
          <div className="ai-hero-context"><span className="ai-connected-dot"/>{workspace?.name ?? "Your workspace"}<ChevronDown size={11}/><span>{selectedProject?.key ?? "Workspace view"}</span></div>
        </div>
        <div className="ai-hero-status">
          <div className="ai-model-orb"><span className="ai-model-ring ai-model-ring-one"/><span className="ai-model-ring ai-model-ring-two"/><span className="ai-model-core"><Sparkles size={19}/></span><i className="ai-model-satellite"/></div>
          <div className="ai-model-caption"><span>ORBIT ASSISTANT</span><strong>Ready to explore</strong></div>
        </div>
        <span className="ai-hero-spark"><Sparkles size={15}/></span>
      </section>

      <div className="ai-workspace-layout">
        <aside className="ai-context-panel bento-enter" aria-label="Assistant context and suggestions">
          <div className="ai-panel-heading"><span className="ai-panel-icon"><Layers3 size={14}/></span><div><h2>Context</h2><p>Choose what the assistant can reference</p></div></div>
          <label className="ai-context-label">ANSWER SCOPE<select value={projectId} onChange={event => setProjectId(event.target.value)} aria-label="Choose answer context" className="ai-context-select"><option value="">All workspace projects</option>{(projects.data ?? []).map(project => <option key={project.id} value={project.id}>{project.name} · {project.key}</option>)}</select></label>
          <div className="ai-scope-card"><span className="ai-scope-icon"><FileText size={14}/></span><div className="min-w-0"><span className="ai-scope-overline">CURRENT SCOPE</span><strong className="truncate">{scopeLabel}</strong></div><Check size={13} className="ai-scope-check"/></div>
          <div className="ai-context-divider"/>
          <div className="ai-suggestion-heading"><div><span className="ai-context-label-static">QUICK STARTS</span><p>Try a question to begin</p></div><Sparkles size={14}/></div>
          <div className="ai-prompt-list">{prompts.map(({ icon: Icon, label, question: prompt, tint }) => <button key={prompt} type="button" onClick={() => usePrompt(prompt)} className={`ai-prompt-card ai-prompt-${tint}`}><span className="ai-prompt-icon"><Icon size={14}/></span><span className="ai-prompt-copy"><strong>{label}</strong><span>{prompt}</span></span><ArrowUpRight size={13} className="ai-prompt-arrow"/></button>)}</div>
          <div className="ai-context-foot"><ShieldCheck size={13}/><span>Responses are scoped to your authorized workspace records.</span></div>
        </aside>

        <section className="ai-chat-panel bento-enter" aria-label="AI chat">
          <header className="ai-chat-header"><div className="flex min-w-0 items-center gap-3"><span className="ai-chat-avatar"><Bot size={16}/><i/></span><div className="min-w-0"><div className="flex items-center gap-2"><h2>Orbit assistant</h2><span className="ai-chat-mode">WORKSPACE AI</span></div><p className="truncate">{selectedProject ? `${selectedProject.name} · ${selectedProject.key}` : workspace?.name ?? "Workspace context"}</p></div></div><div className="ai-chat-header-actions"><span className="ai-ready-status"><i/>Ready</span><span className="ai-answer-count"><MessageSquareText size={12}/>{answerCount}</span><button type="button" onClick={startNewConversation} disabled={!messages.length || ask.isPending} className="ai-new-chat" title="Start a new conversation"><RotateCcw size={13}/><span>New chat</span></button></div></header>

          <div ref={transcriptRef} className="ai-transcript" aria-live="polite">
            {!messages.length && <div className="ai-welcome">
              <div className="ai-welcome-graphic"><span className="ai-welcome-halo"/><span className="ai-welcome-icon"><Sparkles size={21}/></span><i className="ai-welcome-star ai-welcome-star-one"/><i className="ai-welcome-star ai-welcome-star-two"/></div>
              <span className="ai-welcome-kicker">YOUR TEAM KNOWLEDGE, IN CONTEXT</span>
              <h3>What would you like to understand?</h3>
              <p>Ask about delivery, work in progress, or where your team should focus next.</p>
              <div className="ai-welcome-prompts">{prompts.map(({ icon: Icon, question: prompt, tint }) => <button key={prompt} type="button" onClick={() => usePrompt(prompt)} className={`ai-welcome-prompt ai-welcome-${tint}`}><Icon size={14}/><span>{prompt}</span><ArrowUpRight size={12}/></button>)}</div>
            </div>}

            {messages.map((message, index) => <article key={`${index}-${message.question}`} className="ai-message-group">
              <div className="ai-user-message"><span>{message.question}</span><span className="ai-user-monogram">{user?.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "ME"}</span></div>
              {message.result ? <div className="ai-answer-row"><span className="ai-answer-avatar"><Sparkles size={13}/></span><div className="ai-answer-card"><div className="ai-answer-topline"><span><span className="ai-answer-dot"/>ANSWER</span><span>Workspace context</span></div><div className="ai-markdown"><Markdown content={message.result.answer}/></div>{!!message.result.sources.length && <div className="ai-sources"><div className="ai-sources-title"><span>Sources</span><span>{message.result.sources.length} records</span></div><div className="ai-source-list">{message.result.sources.map(source => <span key={`${source.type}-${source.id}`} className="ai-source-chip"><FileText size={11}/>{source.key && <strong>{source.key}</strong>}<span>{source.title}</span><i>{source.type}</i></span>)}</div></div>}</div></div>
                : message.error ? <div role="alert" className="ai-answer-row"><span className="ai-answer-avatar ai-answer-avatar-error"><X size={13}/></span><div className="ai-error-card"><strong>Couldn’t complete that request</strong><span>{message.error}</span></div></div> : null}
            </article>)}

            {ask.isPending && <div className="ai-answer-row ai-thinking-row"><span className="ai-answer-avatar"><Sparkles size={13}/></span><div className="ai-thinking"><span className="ai-thinking-dots"><i/><i/><i/></span><span>Looking through {selectedProject ? selectedProject.name : "your workspace"}…</span></div></div>}
          </div>

          <form onSubmit={submit} className="ai-composer-wrap"><div className="ai-composer"><textarea value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Ask about tasks, delivery, or project progress…" rows={2} maxLength={4000} aria-label="Your question"/><div className="ai-composer-tools"><span><span className="ai-composer-scope-dot"/>{scopeLabel}</span><span className="ai-composer-hint">Enter to send · Shift + Enter for a new line</span><button disabled={ask.isPending || !question.trim() || !workspace} aria-label="Send question" title="Send question"><Send size={15}/></button></div></div><p className="ai-disclaimer"><ShieldCheck size={11}/>AI can make mistakes. Verify important details against the cited records.</p></form>
        </section>
      </div>

      <div className="ai-indexing-note"><span className="ai-indexing-icon"><FileText size={13}/></span><span><strong>Current knowledge sources</strong>Project and task records are connected. Uploaded code indexing and file-level citations are not connected yet.</span></div>
    </div>
  </>;
}
