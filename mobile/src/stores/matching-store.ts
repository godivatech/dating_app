import { create } from 'zustand';
import { apiClient } from '../services/api-client';
import {
  SafeMatch,
  MatchesListResponse,
  UnmatchResponse,
  IncomingNoteItem,
  IncomingNotesResponse,
  RecordActionResponse,
  ActionType,
} from '../../../shared/src/types';

interface MatchingState {
  matches: SafeMatch[];
  cursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;

  incomingNotes: IncomingNoteItem[];
  totalNotesCount: number;
  isNotesLoading: boolean;

  fetchMatches: (refresh?: boolean) => Promise<void>;
  loadMoreMatches: () => Promise<void>;
  unmatch: (matchId: string) => Promise<boolean>;
  fetchIncomingNotes: () => Promise<void>;
  respondToNote: (
    actionId: string,
    senderProfileId: string,
    accept: boolean,
  ) => Promise<{ matched: boolean; match?: SafeMatch } | null>;
}

export const useMatchingStore = create<MatchingState>((set, get) => ({
  matches: [],
  cursor: null,
  hasMore: false,
  isLoading: false,
  isRefreshing: false,
  error: null,

  incomingNotes: [],
  totalNotesCount: 0,
  isNotesLoading: false,

  fetchMatches: async (refresh = false) => {
    if (refresh) {
      set({ isRefreshing: true, error: null });
    } else {
      set({ isLoading: true, error: null });
    }

    try {
      const response = await apiClient.get<MatchesListResponse>('/matches', {
        params: { limit: 20 },
      });

      set({
        matches: response.data.matches,
        cursor: response.data.nextCursor,
        hasMore: response.data.hasMore,
        isLoading: false,
        isRefreshing: false,
      });
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to load matches. Please try again.';
      set({
        error: Array.isArray(msg) ? msg[0] : msg,
        isLoading: false,
        isRefreshing: false,
      });
    }
  },

  loadMoreMatches: async () => {
    const { cursor, hasMore, isLoading, matches } = get();
    if (!hasMore || !cursor || isLoading) return;

    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get<MatchesListResponse>('/matches', {
        params: { limit: 20, cursor },
      });

      set({
        matches: [...matches, ...response.data.matches],
        cursor: response.data.nextCursor,
        hasMore: response.data.hasMore,
        isLoading: false,
      });
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to load more matches.';
      set({
        error: Array.isArray(msg) ? msg[0] : msg,
        isLoading: false,
      });
    }
  },

  unmatch: async (matchId: string) => {
    try {
      await apiClient.delete<UnmatchResponse>(`/matches/${matchId}`);
      // Remove match locally
      set({
        matches: get().matches.filter((m) => m.id !== matchId),
      });
      return true;
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to unmatch.';
      set({ error: Array.isArray(msg) ? msg[0] : msg });
      return false;
    }
  },

  fetchIncomingNotes: async () => {
    set({ isNotesLoading: true });
    try {
      const res = await apiClient.get<IncomingNotesResponse>('/matches/incoming-notes');
      set({
        incomingNotes: res.data.notes || [],
        totalNotesCount: res.data.totalCount || 0,
        isNotesLoading: false,
      });
    } catch {
      set({ isNotesLoading: false });
    }
  },

  respondToNote: async (actionId: string, senderProfileId: string, accept: boolean) => {
    try {
      const res = await apiClient.post<RecordActionResponse>('/actions', {
        targetProfileId: senderProfileId,
        actionType: accept ? ActionType.LIKE : ActionType.PASS,
      });

      // Remove the note from local list
      set((state) => ({
        incomingNotes: state.incomingNotes.filter((n) => n.actionId !== actionId),
        totalNotesCount: Math.max(0, state.totalNotesCount - 1),
      }));

      if (accept && res.data.match) {
        // Add new match to matches list if formed
        set((state) => ({
          matches: [res.data.match!, ...state.matches],
        }));
      }

      return res.data;
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to respond to note.';
      set({ error: Array.isArray(msg) ? msg[0] : msg });
      return null;
    }
  },
}));
