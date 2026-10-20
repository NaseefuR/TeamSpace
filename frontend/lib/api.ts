import type { AIAnswer, AppNotification, Channel, ChannelMember, ChannelMessage, Project, Task, TaskStatusTransition, TaskUpdate, TokenPair, User, WebPushConfig, WebPushSubscriptionInput, WikiPage, WikiPageSummary, WikiVersion, Workspace, WorkspaceFile, WorkspaceMember } from "@/lib/types";
import { useAuth } from "@/store/auth";

const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1")
  .replace(/\/+$/, "");
const API = configuredApiUrl.endsWith("/api/v1")
  ? configuredApiUrl
  : `${configuredApiUrl}/api/v1`;

const refreshRequests = new Map<string, Promise<TokenPair | null>>();

function redirectToLogin() {
  useAuth.getState().clear();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

function isAccessTokenExpired(token?: string): boolean {
  if (!token) return false;
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const expiration: unknown = JSON.parse(decoded).exp;
    return typeof expiration === "number" && expiration <= Date.now() / 1000;
  } catch {
    return false;
  }
}

async function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  const existingRequest = refreshRequests.get(refreshToken);
  if (existingRequest) return existingRequest;

  const refreshRequest = (async () => {
    const response = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (response.status === 401) return null;

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body?.error?.message ?? `Token refresh failed (${response.status})`);
    }
    const tokens = body?.data as TokenPair | undefined;
    if (!tokens?.access_token || !tokens.refresh_token) {
      throw new Error("Token refresh returned an invalid response.");
    }
    useAuth.getState().setTokens(tokens);
    return tokens;
  })();
  refreshRequests.set(refreshToken, refreshRequest);
  try {
    return await refreshRequest;
  } finally {
    if (refreshRequests.get(refreshToken) === refreshRequest) {
      refreshRequests.delete(refreshToken);
    }
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let initialTokens = useAuth.getState().tokens;
  const isAuthRequest = path === "/auth/refresh" || path === "/auth/login";
  if (!isAuthRequest && initialTokens && isAccessTokenExpired(initialTokens.access_token)) {
    if (!initialTokens.refresh_token) {
      redirectToLogin();
      throw new Error("Your session expired. Please sign in again.");
    }
    try {
      const refreshedTokens = await refreshTokens(initialTokens.refresh_token);
      const latestTokens = useAuth.getState().tokens;
      if (refreshedTokens) {
        initialTokens = refreshedTokens;
      } else if (latestTokens?.access_token !== initialTokens.access_token && latestTokens && !isAccessTokenExpired(latestTokens.access_token)) {
        initialTokens = latestTokens;
      } else {
        redirectToLogin();
        throw new Error("Your session expired. Please sign in again.");
      }
    } catch {
      const latestTokens = useAuth.getState().tokens;
      if (latestTokens?.access_token !== initialTokens.access_token && latestTokens && !isAccessTokenExpired(latestTokens.access_token)) {
        initialTokens = latestTokens;
      } else {
        redirectToLogin();
        throw new Error("Your session expired. Please sign in again.");
      }
    }
  }
  const headers = (token?: string) => {
    const requestHeaders = new Headers(init.headers);
    const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
    if (!requestHeaders.has("Content-Type") && !isForm) requestHeaders.set("Content-Type", "application/json");
    if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
    return requestHeaders;
  };
  const sendRequest = async (token?: string) => {
    try {
      return await fetch(`${API}${path}`, { ...init, headers: headers(token) });
    } catch (error) {
      if (!isAuthRequest && isAccessTokenExpired(useAuth.getState().tokens?.access_token)) {
        redirectToLogin();
        throw new Error("Your session expired. Please sign in again.");
      }
      throw error;
    }
  };
  let response = await sendRequest(initialTokens?.access_token);
  if (response.status === 401 && !isAuthRequest) {
    if (!initialTokens?.refresh_token) {
      redirectToLogin();
      throw new Error("Your session expired. Please sign in again.");
    }
    let retryTokens = useAuth.getState().tokens;
    let attemptedRefreshToken: string | null = null;
    if (!retryTokens?.access_token || retryTokens.access_token === initialTokens.access_token) {
      const refreshToken = retryTokens?.refresh_token ?? initialTokens.refresh_token;
      attemptedRefreshToken = refreshToken;
      try {
        retryTokens = await refreshTokens(refreshToken);
      } catch {
        const latestTokens = useAuth.getState().tokens;
        if (latestTokens?.access_token && latestTokens.access_token !== initialTokens.access_token) {
          retryTokens = latestTokens;
        } else {
          redirectToLogin();
          throw new Error("Your session expired. Please sign in again.");
        }
      }
    }
    if (!retryTokens?.access_token) {
      if (attemptedRefreshToken && useAuth.getState().tokens?.refresh_token === attemptedRefreshToken) {
        redirectToLogin();
      }
      throw new Error("Your session expired. Please sign in again.");
    }
    response = await sendRequest(retryTokens.access_token);
    if (response.status === 401) {
      if (useAuth.getState().tokens?.access_token === retryTokens.access_token) {
        redirectToLogin();
      }
      throw new Error("Your session expired. Please sign in again.");
    }
  }
  if (!response.ok) {
    const body = await response.json();
    const error = body?.error;
    throw new Error(error?.message ?? `Request failed (${response.status})`);
  }
  if (!response.headers.get("content-type")?.includes("application/json")) return await response.blob() as T;
  const body = await response.json();
  return body.data as T;
}

export const api = {
  login: (email: string, password: string) => request<TokenPair>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<User>("/users/me"),
  updateProfile: (body: Partial<Pick<User, "name" | "designation" | "timezone">>) => request<User>("/users/me", { method: "PATCH", body: JSON.stringify(body) }),
  workspaces: () => request<Workspace[]>("/workspaces"),
  createWorkspace: (body: { name: string; slug: string; description?: string }) => request<Workspace>("/workspaces", { method: "POST", body: JSON.stringify(body) }),
  updateWorkspace: (id: string, body: Partial<Pick<Workspace, "name" | "slug" | "description">>) => request<Workspace>(`/workspaces/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  projects: (workspaceId: string) => request<Project[]>(`/workspaces/${workspaceId}/projects?page=1&page_size=100`),
  createProject: (workspaceId: string, name: string, key: string) => request<Project>(`/workspaces/${workspaceId}/projects`, { method: "POST", body: JSON.stringify({ name, key }) }),
  members: (workspaceId: string) => request<WorkspaceMember[]>(`/workspaces/${workspaceId}/members?page=1&page_size=100`),
  addMember: (workspaceId: string, email: string, role: "admin" | "member" | "guest") => request<WorkspaceMember>(`/workspaces/${workspaceId}/members`, { method: "POST", body: JSON.stringify({ email, role }) }),
  createMemberAccount: (workspaceId: string, body: { name: string; email: string; password: string; role: "admin" | "member" | "guest" }) => request<WorkspaceMember>(`/workspaces/${workspaceId}/members/accounts`, { method: "POST", body: JSON.stringify(body) }),
  notifications: (page = 1) => request<AppNotification[]>(`/notifications?page=${page}&page_size=50`),
  unreadCount: () => request<{ unread_count: number }>("/notifications/unread-count"),
  markNotificationRead: (id: string) => request<{ id: string; is_read: boolean }>(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => request<{ updated_count: number }>("/notifications/read-all", { method: "POST" }),
  webPushConfig: () => request<WebPushConfig>("/notifications/push-config"),
  registerWebPushSubscription: (body: WebPushSubscriptionInput) => request<{ id: string; subscribed: boolean }>("/notifications/push-subscriptions", { method: "POST", body: JSON.stringify(body) }),
  removeWebPushSubscription: (endpoint: string) => request<{ removed: boolean }>("/notifications/push-subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint }) }),
  channels: (workspaceId: string) => request<Channel[]>(`/workspaces/${workspaceId}/channels`),
  createChannel: (workspaceId: string, body: { name: string; description?: string; is_private: boolean }) => request<Channel>(`/workspaces/${workspaceId}/channels`, { method: "POST", body: JSON.stringify(body) }),
  archiveChannel: (channelId: string) => request<{ id: string; archived: boolean }>(`/channels/${channelId}`, { method: "DELETE" }),
  channelMessages: (channelId: string, parentMessageId?: string) => request<ChannelMessage[]>(`/channels/${channelId}/messages?page=1&page_size=100${parentMessageId ? `&parent_message_id=${encodeURIComponent(parentMessageId)}` : ""}`),
  createChannelMessage: (channelId: string, body: { body: string; parent_message_id?: string | null }) => request<ChannelMessage>(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify(body) }),
  updateChannelMessage: (channelId: string, messageId: string, body: string) => request<ChannelMessage>(`/channels/${channelId}/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ body }) }),
  deleteChannelMessage: (channelId: string, messageId: string) => request<{ id: string; deleted: boolean }>(`/channels/${channelId}/messages/${messageId}`, { method: "DELETE" }),
  addChannelMember: (channelId: string, userId: string) => request<{ id: string; channel_id: string; user_id: string }>(`/channels/${channelId}/members`, { method: "POST", body: JSON.stringify({ user_id: userId }) }),
  channelMembers: (channelId: string) => request<ChannelMember[]>(`/channels/${channelId}/members`),
  removeChannelMember: (channelId: string, userId: string) => request<{ channel_id: string; user_id: string; removed: boolean }>(`/channels/${channelId}/members/${userId}`, { method: "DELETE" }),
  docs: (workspaceId: string) => request<WikiPageSummary[]>(`/workspaces/${workspaceId}/docs?page=1&page_size=100`),
  workspaceFiles: (workspaceId: string) => request<WorkspaceFile[]>(`/workspaces/${workspaceId}/files`),
  uploadWorkspaceFile: (workspaceId: string, file: File) => { const form = new FormData(); form.append("file", file); return request<WorkspaceFile>(`/workspaces/${workspaceId}/files`, { method: "POST", body: form }); },
  downloadWorkspaceFile: (fileId: string) => request<Blob>(`/workspace-files/${fileId}/download`),
  deleteWorkspaceFile: (fileId: string) => request<{ id: string; deleted: boolean }>(`/workspace-files/${fileId}`, { method: "DELETE" }),
  doc: (pageId: string) => request<WikiPage>(`/docs/${pageId}`),
  createDoc: (workspaceId: string, body: { title: string; content: string; parent_page_id?: string | null }) => request<WikiPage>(`/workspaces/${workspaceId}/docs`, { method: "POST", body: JSON.stringify(body) }),
  updateDoc: (pageId: string, body: { title: string; content: string; change_summary?: string }) => request<WikiPage>(`/docs/${pageId}`, { method: "PATCH", body: JSON.stringify(body) }),
  docVersions: (pageId: string) => request<WikiVersion[]>(`/docs/${pageId}/versions`),
  archiveDoc: (pageId: string) => request<{ id: string; archived: boolean }>(`/docs/${pageId}`, { method: "DELETE" }),
  tasks: (projectId: string) => request<Task[]>(`/projects/${projectId}/tasks?page=1&page_size=100`),
  createTask: (projectId: string, body: { title: string; assignee_id?: string | null; status?: string; priority?: string; severity?: Task["severity"] }) => request<Task>(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(body) }),
  updateTask: (taskId: string, changes: TaskUpdate) => request<Task>(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(changes) }),
  deleteTask: (taskId: string) => request<{ deleted: boolean; id: string }>(`/tasks/${taskId}`, { method: "DELETE" }),
  taskStatusHistory: (taskId: string) => request<TaskStatusTransition[]>(`/tasks/${taskId}/status-history`),
  askAI: (workspaceId: string, question: string, projectId?: string) => request<AIAnswer>("/ai/chat", { method: "POST", body: JSON.stringify({ workspace_id: workspaceId, question, project_id: projectId || null }) }),
};

export function taskKey(project: Project, task: Task) { return `${project.key}-${task.number}`; }
