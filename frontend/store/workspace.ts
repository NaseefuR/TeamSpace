import { create } from "zustand";

type WorkspaceState = { selectedId: string | null; select: (id: string | null) => void };
export const useWorkspace = create<WorkspaceState>((set) => ({ selectedId: null, select: (selectedId) => set({ selectedId }) }));
