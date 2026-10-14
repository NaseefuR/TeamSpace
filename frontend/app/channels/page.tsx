"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, MessageSquareText, Plus, Radio, Reply, Send, Trash2, UsersRound, X } from "lucide-react";
import { api } from "@/lib/api";
import { Markdown } from "@/components/markdown";
import { useAuth } from "@/store/auth";
import { useWorkspace } from "@/store/workspace";
import type { ChannelMessage } from "@/lib/types";
import "./channels.css";

const clock = (value: string) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
const initials = (name: string) => name.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase();

export default function ChannelsPage() {
  const selectedWorkspaceId = useWorkspace(state => state.selectedId);
  const user = useAuth(state => state.user);
  const client = useQueryClient();
  const workspaceList = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces, enabled: !!user });
  const workspaceId = selectedWorkspaceId ?? workspaceList.data?.[0]?.id ?? null;
  const [channelId, setChannelId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [memberToAdd, setMemberToAdd] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [channelToArchive, setChannelToArchive] = useState<{ id: string; name: string } | null>(null);

  const channels = useQuery({ queryKey: ["channels", workspaceId], queryFn: () => api.channels(workspaceId!), enabled: !!workspaceId });
  const members = useQuery({ queryKey: ["members", workspaceId], queryFn: () => api.members(workspaceId!), enabled: !!workspaceId });
  useEffect(() => {
    if (!channels.data?.length) { setChannelId(null); return; }
    if (!channelId || !channels.data.some(channel => channel.id === channelId)) setChannelId(channels.data[0].id);
  }, [channels.data, channelId]);
  useEffect(() => { setThreadId(null); }, [channelId]);

  const activeChannel = useMemo(() => channels.data?.find(channel => channel.id === channelId) ?? null, [channels.data, channelId]);
  const channelMessages = useQuery({ queryKey: ["channel-messages", channelId], queryFn: () => api.channelMessages(channelId!), enabled: !!channelId, refetchInterval: 5000 });
  const threadMessages = useQuery({ queryKey: ["channel-thread", channelId, threadId], queryFn: () => api.channelMessages(channelId!, threadId!), enabled: !!channelId && !!threadId, refetchInterval: 5000 });
  const privateMembers = useQuery({ queryKey: ["channel-members", channelId], queryFn: () => api.channelMembers(channelId!), enabled: !!activeChannel?.is_private });
  const ownMembership = members.data?.find(member => member.user_id === user?.id);
  const mayManagePrivate = !!activeChannel && (activeChannel.created_by === user?.id || ["owner", "admin"].includes(ownMembership?.role ?? ""));
  const canArchiveChannel = (channel: NonNullable<typeof channels.data>[number]) =>
    channel.created_by === user?.id || ["owner", "admin"].includes(ownMembership?.role ?? "");

  const createChannel = useMutation({
    mutationFn: () => api.createChannel(workspaceId!, { name: channelName.trim(), description: channelDescription.trim() || undefined, is_private: isPrivate }),
    onSuccess: async created => { await client.invalidateQueries({ queryKey: ["channels", workspaceId] }); setChannelId(created.id); setChannelName(""); setChannelDescription(""); setIsPrivate(false); setShowCreate(false); },
  });
  const archiveChannel = useMutation({
    mutationFn: (id: string) => api.archiveChannel(id),
    onSuccess: async (_result, id) => {
      client.setQueryData<typeof channels.data>(["channels", workspaceId], current => current?.filter(channel => channel.id !== id));
      if (channelId === id) setChannelId(null);
      setChannelToArchive(null);
      await client.invalidateQueries({ queryKey: ["channels", workspaceId] });
    },
  });
  useEffect(() => {
    if (!channelToArchive || archiveChannel.isPending) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChannelToArchive(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [channelToArchive, archiveChannel.isPending]);
  const postMessage = useMutation({
    mutationFn: () => api.createChannelMessage(channelId!, { body: messageDraft, parent_message_id: threadId }),
    onSuccess: async () => { setMessageDraft(""); await client.invalidateQueries({ queryKey: ["channel-messages", channelId] }); await client.invalidateQueries({ queryKey: ["channel-thread", channelId, threadId] }); },
  });
  const addMember = useMutation({
    mutationFn: () => api.addChannelMember(channelId!, memberToAdd),
    onSuccess: async () => { setMemberToAdd(""); await client.invalidateQueries({ queryKey: ["channel-members", channelId] }); },
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => api.removeChannelMember(channelId!, userId),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["channel-members", channelId] }); },
  });
  const updateMessage = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api.updateChannelMessage(channelId!, id, body),
    onSuccess: async () => { setEditingId(null); await client.invalidateQueries({ queryKey: ["channel-messages", channelId] }); await client.invalidateQueries({ queryKey: ["channel-thread", channelId] }); },
  });
  const deleteMessage = useMutation({
    mutationFn: (id: string) => api.deleteChannelMessage(channelId!, id),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["channel-messages", channelId] }); await client.invalidateQueries({ queryKey: ["channel-thread", channelId] }); },
  });

  function create(event: FormEvent) { event.preventDefault(); if (channelName.trim()) createChannel.mutate(); }
  function send(event: FormEvent) { event.preventDefault(); if (messageDraft.trim() && channelId) postMessage.mutate(); }
  function edit(event: FormEvent, message: ChannelMessage) { event.preventDefault(); if (editDraft.trim()) updateMessage.mutate({ id: message.id, body: editDraft.trim() }); }
  const renderMessage = (message: ChannelMessage) => <article key={message.id} className="chat-message group">
    <div className="chat-avatar">{initials(message.user_name)}</div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-[12px] font-semibold text-ink">{message.user_name}</span><time className="text-[10px] text-muted" dateTime={message.created_at}>{clock(message.created_at)}{message.edited_at && <span> · edited</span>}</time></div>
      {editingId === message.id ? <form onSubmit={event => edit(event, message)} className="mt-2 space-y-2"><textarea value={editDraft} onChange={event => setEditDraft(event.target.value)} rows={3} className="chat-composer-input w-full resize-y rounded-xl border border-line p-3 text-sm"/><div className="flex gap-2"><button className="chat-small-button">Save</button><button type="button" onClick={() => setEditingId(null)} className="text-xs text-muted">Cancel</button></div></form> : <div className="chat-message-body mt-1 text-[13px] leading-6 text-body"><Markdown content={message.body}/></div>}
      <div className="mt-2 flex items-center gap-3 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        {!message.parent_message_id && <button onClick={() => setThreadId(message.id)} className="chat-action"><Reply size={12}/> Reply in thread</button>}
        {message.user_id === user?.id && !message.deleted_at && <button onClick={() => { setEditingId(message.id); setEditDraft(message.body); }} className="chat-action">Edit</button>}
        {(message.user_id === user?.id || ["owner", "admin"].includes(ownMembership?.role ?? "")) && !message.deleted_at && <button onClick={() => deleteMessage.mutate(message.id)} className="chat-action chat-action-danger">Delete</button>}
      </div>
    </div>
  </article>;

  return <div className="collab-page channels-page">
    <section className="collab-hero channels-hero">
      <div className="collab-hero-orbit"/><div className="collab-kicker"><span className="collab-kicker-dot"/> TEAM COMMUNICATION</div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-5"><div><h1>Conversations, in context.</h1><p>Bring project questions, decisions, and quick updates into one shared space.</p></div><div className="collab-hero-stat"><Radio size={15}/><span><strong>Live channels</strong><small>Updates refresh automatically</small></span></div></div>
    </section>

    {!workspaceId ? <div className="collab-empty mt-5">Choose a workspace to open team channels.</div> : <section className="channels-layout">
      <aside className="channel-rail collab-panel">
        <div className="flex items-center justify-between"><div><span className="collab-overline">YOUR WORKSPACE</span><h2 className="mt-1 text-[15px] font-semibold text-ink">Channels</h2></div><button onClick={() => setShowCreate(true)} title="Create a channel" className="channel-add"><Plus size={16}/></button></div>
        <div className="mt-5 flex items-center gap-2 px-2"><span className="collab-overline">CHANNELS</span><span className="channel-count">{channels.data?.length ?? 0}</span></div>
        <div className="mt-2 space-y-1">
          {channels.isLoading && <p className="px-2 py-3 text-xs text-muted">Opening channels…</p>}
          {channels.error && <p role="alert" className="px-2 py-3 text-xs text-red-500">{channels.error.message}</p>}
          {channels.data?.map(channel => <div key={channel.id} className="channel-row">
            <button onClick={() => setChannelId(channel.id)} className={`channel-link ${channel.id === channelId ? "channel-link-active" : ""}`}><span className="channel-link-icon">{channel.is_private ? <LockKeyhole size={13}/> : <span>#</span>}</span><span className="min-w-0 flex-1 truncate">{channel.name}</span></button>
            {canArchiveChannel(channel) && <button type="button" className="channel-archive-button" title={`Archive ${channel.name}`} aria-label={`Archive channel ${channel.name}`} disabled={archiveChannel.isPending} onClick={() => {
              archiveChannel.reset();
              setChannelToArchive({ id: channel.id, name: channel.name });
            }}><Trash2 size={13}/></button>}
          </div>)}
          {archiveChannel.error && <p role="alert" className="px-2 py-2 text-xs text-red-500">{archiveChannel.error.message}</p>}
          {!channels.isLoading && !channels.error && channels.data?.length === 0 && <p className="px-2 py-3 text-xs leading-5 text-muted">Start the conversation with a channel for your team.</p>}
        </div>
        <div className="channel-rail-footer"><UsersRound size={14}/><span>{members.data?.length ?? 0} workspace members</span></div>
      </aside>

      {activeChannel ? <section className="channel-conversation collab-panel">
        <header className="channel-header"><div className="min-w-0"><div className="flex items-center gap-2"><span className="channel-title-icon">{activeChannel.is_private ? <LockKeyhole size={15}/> : "#"}</span><h2 className="truncate text-[16px] font-semibold text-ink">{activeChannel.name}</h2><span className="channel-private-badge">{activeChannel.is_private ? "PRIVATE" : "PUBLIC"}</span></div><p className="mt-1 truncate pl-7 text-[11px] text-muted">{activeChannel.description || "A place for the team to share updates and ideas."}</p></div><div className="channel-live"><span/> LIVE</div></header>
        {activeChannel.is_private && mayManagePrivate && <form onSubmit={event => { event.preventDefault(); if (memberToAdd) addMember.mutate(); }} className="channel-member-tools"><span className="channel-tools-label">PRIVATE ACCESS</span><select aria-label="Choose a workspace member" value={memberToAdd} onChange={event => setMemberToAdd(event.target.value)}><option value="">Add a workspace member…</option>{members.data?.filter(member => member.user_id !== activeChannel.created_by && !privateMembers.data?.some(existing => existing.user_id === member.user_id)).map(member => <option value={member.user_id} key={member.user_id}>{member.name} · {member.email}</option>)}</select><button disabled={!memberToAdd || addMember.isPending} className="chat-small-button">{addMember.isPending ? "Adding…" : "Add"}</button>{addMember.error && memberToAdd && <span role="alert" className="text-[10px] text-red-500">{addMember.error.message}</span>}</form>}
        {activeChannel.is_private && <div className="channel-private-members"><span className="channel-private-members-label">MEMBERS <b>{privateMembers.data?.length ?? 0}</b></span><div className="channel-private-member-list">{privateMembers.data?.map(member => <span key={member.user_id} className="channel-private-member"><span className="channel-private-member-avatar">{initials(member.name)}</span>{member.name}{mayManagePrivate && member.user_id !== activeChannel.created_by && <button type="button" title={`Remove ${member.name}`} aria-label={`Remove ${member.name}`} onClick={() => removeMember.mutate(member.user_id)}><X size={11}/></button>}</span>)}</div>{removeMember.error && <span role="alert" className="text-[10px] text-red-500">{removeMember.error.message}</span>}</div>}
        <div className={`conversation-columns ${threadId ? "conversation-with-thread" : ""}`}>
          <div className="message-column">
            <div className="messages-scroll">
              {!channelMessages.data?.length && !channelMessages.isLoading && <div className="chat-welcome"><span className="chat-welcome-icon"><MessageSquareText size={21}/></span><h3>Welcome to #{activeChannel.name}</h3><p>This is the start of the conversation. Share a thought, ask a question, or post a team update.</p></div>}
              {channelMessages.isLoading && <p className="p-5 text-xs text-muted">Loading conversation…</p>}
              {channelMessages.error && <p role="alert" className="p-5 text-xs text-red-500">{channelMessages.error.message}</p>}
              {channelMessages.data?.map(renderMessage)}
            </div>
            <form onSubmit={send} className="message-composer"><textarea value={messageDraft} onChange={event => setMessageDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (messageDraft.trim()) postMessage.mutate(); } }} rows={2} maxLength={10000} aria-label="Write a message" placeholder={threadId ? "Reply to this thread…" : `Message #${activeChannel.name}`} className="chat-composer-input"/><div className="composer-bottom"><span>{threadId ? "Replying in thread · Shift + Enter for a new line" : "Markdown supported · Shift + Enter for a new line"}</span><button disabled={!messageDraft.trim() || postMessage.isPending} aria-label="Send message" className="send-message"><Send size={14}/></button></div>{postMessage.error && <p role="alert" className="mt-2 text-[11px] text-red-500">{postMessage.error.message}</p>}</form>
          </div>
          {threadId && <aside className="thread-panel"><header><div><span className="collab-overline">THREAD</span><h3 className="mt-1 text-sm font-semibold text-ink">Replies</h3></div><button onClick={() => setThreadId(null)} aria-label="Close thread" className="channel-add"><X size={14}/></button></header><div className="thread-messages">{channelMessages.data?.filter(message => message.id === threadId).map(renderMessage)}{threadMessages.data?.map(renderMessage)}{threadMessages.isLoading && <p className="text-xs text-muted">Loading replies…</p>}</div></aside>}
        </div>
      </section> : <section className="channel-conversation collab-panel channel-no-selection"><div className="chat-welcome"><span className="chat-welcome-icon"><MessageSquareText size={21}/></span><h3>Make room for good ideas</h3><p>Create a channel to start a team conversation.</p><button onClick={() => setShowCreate(true)} className="collab-primary mt-5"><Plus size={14}/> Create channel</button></div></section>}
    </section>}

    {showCreate && <div className="collab-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowCreate(false); }}><form onSubmit={create} className="collab-modal"><div className="flex items-start justify-between"><div><span className="collab-modal-icon"><MessageSquareText size={17}/></span><h2 className="mt-4 text-lg font-semibold text-ink">Create a channel</h2><p className="mt-1 text-sm text-muted">Give the team a focused place to talk.</p></div><button type="button" onClick={() => setShowCreate(false)} aria-label="Close" className="channel-add"><X size={15}/></button></div><label className="collab-label">Channel name<input required minLength={2} maxLength={80} value={channelName} onChange={event => setChannelName(event.target.value)} placeholder="product-updates" autoFocus/></label><label className="collab-label">Description <span>· optional</span><textarea maxLength={500} rows={3} value={channelDescription} onChange={event => setChannelDescription(event.target.value)} placeholder="What should live in this channel?"/></label><label className="private-toggle"><span className="private-toggle-icon"><LockKeyhole size={14}/></span><span><strong>Private channel</strong><small>Only invited workspace members can see its messages.</small></span><input type="checkbox" checked={isPrivate} onChange={event => setIsPrivate(event.target.checked)}/></label>{createChannel.error && <p role="alert" className="mt-3 text-xs text-red-500">{createChannel.error.message}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="channel-cancel">Cancel</button><button disabled={!channelName.trim() || createChannel.isPending} className="collab-primary">{createChannel.isPending ? "Creating…" : "Create channel"}</button></div></form></div>}
    {channelToArchive && <div className="collab-modal-backdrop archive-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !archiveChannel.isPending) setChannelToArchive(null); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="archive-channel-title" aria-describedby="archive-channel-description" className="collab-modal archive-confirm-modal">
        <div className="archive-confirm-heading">
          <span className="archive-confirm-icon"><Trash2 size={17}/></span>
          <span className="archive-confirm-label">CHANNEL ARCHIVE</span>
        </div>
        <h2 id="archive-channel-title" className="archive-confirm-title">Archive <span>#{channelToArchive.name}</span>?</h2>
        <p id="archive-channel-description" className="archive-confirm-description">This channel will be removed from the workspace. Its messages will no longer be available to the team.</p>
        {archiveChannel.error && <p role="alert" className="archive-confirm-error">{archiveChannel.error.message}</p>}
        <div className="archive-confirm-actions">
          <button type="button" className="channel-cancel" disabled={archiveChannel.isPending} onClick={() => setChannelToArchive(null)}>Keep channel</button>
          <button type="button" className="archive-confirm-submit" disabled={archiveChannel.isPending} autoFocus onClick={() => archiveChannel.mutate(channelToArchive.id)}>{archiveChannel.isPending ? "Archiving…" : "Archive channel"}</button>
        </div>
      </section>
    </div>}
  </div>;
}
