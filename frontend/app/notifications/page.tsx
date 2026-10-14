"use client";

import "./notifications.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  ClipboardList,
  FileBarChart2,
  FolderKanban,
  Mail,
  MessageCircle,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { api } from "@/lib/api";
import type { AppNotification } from "@/lib/types";
import { useAuth } from "@/store/auth";
import type { WebPushSubscriptionInput } from "@/lib/types";

type View = "all" | "unread";
function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const elapsed = Date.now() - date.getTime();
  if (elapsed >= 0 && elapsed < 60_000) return "Just now";
  if (elapsed >= 60_000 && elapsed < 60 * 60_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed >= 60 * 60_000 && elapsed < 24 * 60 * 60_000) return `${Math.floor(elapsed / (60 * 60_000))}h ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" as const } : {}) }).format(date);
}
function dateGroup(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Earlier";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (date >= today) return "Today";
  if (date >= yesterday) return "Yesterday";
  return "Earlier";
}
function NotificationIcon({ type }: { type: string }) {
  const value = type.toLowerCase();
  if (value.includes("task") || value.includes("assign")) return <ClipboardList size={16}/>;
  if (value.includes("comment") || value.includes("mention")) return <MessageCircle size={16}/>;
  if (value.includes("project")) return <FolderKanban size={16}/>;
  if (value.includes("member") || value.includes("invite")) return <UsersRound size={16}/>;
  if (value.includes("report")) return <FileBarChart2 size={16}/>;
  if (value.includes("email")) return <Mail size={16}/>;
  return <Bell size={16}/>;
}
function groupNotifications(items: AppNotification[]) {
  const groups: { title: string; items: AppNotification[] }[] = [];
  for (const item of items) {
    const title = dateGroup(item.created_at);
    let group = groups.find(candidate => candidate.title === title);
    if (!group) { group = { title, items: [] }; groups.push(group); }
    group.items.push(item);
  }
  return groups;
}

function decodeApplicationServerKey(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const bytes = Uint8Array.from(atob(padded), character => character.charCodeAt(0));
  return bytes.buffer;
}

function serializePushSubscription(subscription: PushSubscription): WebPushSubscriptionInput {
  const value = subscription.toJSON();
  if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth) {
    throw new Error("The browser returned an incomplete push subscription.");
  }
  return { endpoint: value.endpoint, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } };
}

export default function NotificationsPage() {
  const router = useRouter();
  const user = useAuth(state => state.user);
  const client = useQueryClient();
  const [view, setView] = useState<View>("all");
  const [pushSupported, setPushSupported] = useState<boolean | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null);
  const [browserSubscribed, setBrowserSubscribed] = useState(false);
  const [pushSetupError, setPushSetupError] = useState<string | null>(null);

  useEffect(() => { if (!useAuth.getState().tokens) router.replace("/login"); }, [router]);

  const notifications = useQuery({ queryKey: ["notifications", 1], queryFn: () => api.notifications(1), enabled: !!user, refetchInterval: 30_000 });
  const unread = useQuery({ queryKey: ["notifications", "unread-count"], queryFn: api.unreadCount, enabled: !!user, refetchInterval: 30_000 });
  const pushConfig = useQuery({ queryKey: ["web-push-config"], queryFn: api.webPushConfig, enabled: !!user });
  const markOne = useMutation({ mutationFn: api.markNotificationRead, onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }) });
  const markAll = useMutation({ mutationFn: api.markAllNotificationsRead, onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }) });
  const enablePush = useMutation({
    mutationFn: async () => {
      const config = await api.webPushConfig();
      if (!config.enabled || !config.public_key) throw new Error("Web push is not configured on this server.");
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== "granted") throw new Error("Allow notifications in your browser to enable web push.");
      const registration = await navigator.serviceWorker.register("/service-worker.js");
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      let createdHere = false;
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(config.public_key),
        });
        createdHere = true;
      }
      try {
        await api.registerWebPushSubscription(serializePushSubscription(subscription));
      } catch (error) {
        if (createdHere) await subscription.unsubscribe();
        throw error;
      }
    },
    onSuccess: () => { setBrowserSubscribed(true); setPushSetupError(null); },
    onError: error => setPushSetupError(error.message),
  });
  const disablePush = useMutation({
    mutationFn: async () => {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) return;
      await api.removeWebPushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    },
    onSuccess: () => { setBrowserSubscribed(false); setPushSetupError(null); },
    onError: error => setPushSetupError(error.message),
  });

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setPushSupported(supported);
    if (!supported) return;
    setPushPermission(Notification.permission);
    let active = true;
    navigator.serviceWorker.getRegistration("/").then(async registration => {
      const subscription = await registration?.pushManager.getSubscription();
      if (!active || !subscription) return;
      setBrowserSubscribed(true);
      const config = await api.webPushConfig();
      if (active && config.enabled) {
        await api.registerWebPushSubscription(serializePushSubscription(subscription));
      }
    }).catch(error => {
      if (active) setPushSetupError(error instanceof Error ? error.message : "Could not check this browser's push subscription.");
    });
    return () => { active = false; };
  }, [user?.id]);

  const items = (notifications.data ?? []).filter(item => view === "all" || !item.is_read);
  const groups = useMemo(() => groupNotifications(items), [items]);
  const unreadCount = unread.data?.unread_count ?? 0;
  const loadedCount = notifications.data?.length ?? 0;

  return <>
    <div className="notifications-page">
      <section className="notifications-hero bento-enter">
        <div className="notifications-hero-grid" aria-hidden="true"/><div className="notifications-hero-orbit notifications-hero-orbit-one" aria-hidden="true"/><div className="notifications-hero-orbit notifications-hero-orbit-two" aria-hidden="true"/>
        <div className="notifications-hero-copy"><div className="notifications-eyebrow"><span><Bell size={13}/></span> WORKSPACE SIGNALS <i/> YOUR ACTIVITY</div><h1>Notifications<span>.</span></h1><p>A clear timeline of the updates that need your attention.</p><div className="notifications-live-chip"><i/>Live updates <span/>Refreshes every 30 seconds</div></div>
        <div className="notifications-hero-stats"><div className="notifications-stat notifications-stat-primary"><span><Bell size={12}/> UNREAD</span><strong>{String(unreadCount).padStart(2, "0")}</strong><small>need your attention</small></div><div className="notifications-stat"><span><Sparkles size={12}/> RECENT</span><strong>{notifications.isLoading ? "—" : String(loadedCount).padStart(2, "0")}</strong><small>updates in this feed</small></div></div>
        <span className="notifications-hero-spark"><Sparkles size={15}/></span>
      </section>

      <section className="notifications-push-card bento-enter" aria-labelledby="notifications-push-title">
        <span className="notifications-push-icon">{browserSubscribed ? <BellRing size={17}/> : <BellOff size={17}/>}</span>
        <div className="notifications-push-copy">
          <h2 id="notifications-push-title">Web push notifications</h2>
          <p>{!pushConfig.data?.enabled ? "Push delivery is not configured on this TeamSpace server yet." : pushPermission === "denied" ? "Notifications are blocked by your browser. Change the site permission in browser settings to enable them." : browserSubscribed ? "This browser can receive updates even when TeamSpace is closed." : "Enable push separately in each browser where you want to receive updates, even when TeamSpace is closed."}</p>
          {pushSetupError && <span role="alert" className="notifications-push-error">{pushSetupError}</span>}
          {pushConfig.error && <span role="alert" className="notifications-push-error">{pushConfig.error.message}</span>}
        </div>
        <button type="button" className={`notifications-push-button ${browserSubscribed ? "notifications-push-enabled" : ""}`} disabled={pushSupported === null || !pushConfig.data?.enabled || !pushSupported || pushPermission === "denied" || pushConfig.isLoading || enablePush.isPending || disablePush.isPending} onClick={() => browserSubscribed ? disablePush.mutate() : enablePush.mutate()}>
          {enablePush.isPending || disablePush.isPending ? "Updating…" : browserSubscribed ? "Turn off on this browser" : "Enable web push"}
        </button>
        {pushSupported === false && <span className="notifications-push-note">This browser does not support web push.</span>}
      </section>

      <section className="notifications-inbox bento-enter">
        <header className="notifications-inbox-header"><div className="notifications-inbox-title"><span className="notifications-inbox-icon"><Bell size={15}/></span><div><h2>Your inbox</h2><p>Recent workspace activity, in one place</p></div></div><div className="notifications-inbox-actions"><div className="notifications-view-switch" role="tablist" aria-label="Notification view"><button type="button" role="tab" aria-selected={view === "all"} onClick={() => setView("all")} className={view === "all" ? "active" : ""}>All <span>{loadedCount}</span></button><button type="button" role="tab" aria-selected={view === "unread"} onClick={() => setView("unread")} className={view === "unread" ? "active" : ""}>Unread <span>{unreadCount}</span></button></div><button type="button" onClick={() => markAll.mutate()} disabled={!unreadCount || markAll.isPending} className="notifications-mark-all"><CheckCheck size={13}/>{markAll.isPending ? "Marking…" : "Mark all read"}</button></div></header>

        {notifications.isLoading ? <div className="notifications-loading">{[0, 1, 2, 3].map(index => <div className="notification-skeleton" key={index}><i/><span/><span/></div>)}</div>
          : notifications.error ? <div role="alert" className="notifications-error"><Bell size={15}/>{notifications.error.message}</div>
          : groups.length ? <div className="notifications-feed">{groups.map(group => <section key={group.title} className="notifications-day-group"><div className="notifications-day-heading"><span>{group.title}</span><i/></div><div className="notifications-items">{group.items.map(item => <article key={item.id} className={`notification-card ${item.is_read ? "notification-read" : "notification-unread"}`}>
            <span className={`notification-type-icon notification-type-${item.type.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}><NotificationIcon type={item.type}/></span>
            <div className="notification-card-content"><div className="notification-card-title-row"><h3>{item.title}</h3>{!item.is_read && <span className="notification-unread-dot"/>}</div><p>{item.body}</p><div className="notification-meta"><span className="notification-kind">{item.type.replaceAll("_", " ")}</span><span className="notification-meta-dot">·</span><time dateTime={item.created_at}>{formatTime(item.created_at)}</time></div></div>
            <div className="notification-card-actions">{item.link && <Link href={item.link} onClick={() => { if (!item.is_read) markOne.mutate(item.id); }} className="notification-open-link">Open<ArrowUpRightIcon/></Link>}{!item.is_read && <button type="button" aria-label="Mark as read" title="Mark as read" onClick={() => markOne.mutate(item.id)} disabled={markOne.isPending} className="notification-read-button"><Check size={14}/></button>}</div>
          </article>)}</div></section>)}</div>
          : <div className="notifications-empty"><span className="notifications-empty-icon">{view === "unread" ? <CheckCheck size={20}/> : <Bell size={20}/>}</span><h2>{view === "unread" ? "You’re all caught up" : "No updates yet"}</h2><p>{view === "unread" ? "New updates will appear here when something changes." : "When something changes across your work, you’ll find it here."}</p>{view === "unread" && <button type="button" onClick={() => setView("all")}>View all updates</button>}</div>}
      </section>
      <p className="notifications-footer"><ShieldCheckIcon/>Only notifications available to your account appear in this feed.</p>
    </div>
  </>;
}

function ArrowUpRightIcon() { return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 11.5 11 5M5 5h6v6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></svg>; }
function ShieldCheckIcon() { return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8 13 3.7v3.5c0 3-2 5.6-5 7-3-1.4-5-4-5-7V3.7L8 1.8Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.2"/><path d="m5.7 7.8 1.5 1.5 3.2-3.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2"/></svg>; }
