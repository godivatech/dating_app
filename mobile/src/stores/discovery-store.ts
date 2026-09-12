import { create } from 'zustand';
import { apiClient } from '../services/api-client';
import { useBillingStore } from './billing-store';
import {
  DiscoveryCandidate,
  DiscoveryEligibilityStatus,
  DiscoveryFeedResponse,
  RecordImpressionResponse,
  ActionType,
  RecordActionResponse,
  SafeMatch,
} from '../../../shared/src/types';

interface DiscoveryState {
  candidates: DiscoveryCandidate[];
  currentIndex: number;
  currentPhotoIndex: number;
  cursor: string | null;
  hasMore: boolean;
  eligibility: DiscoveryEligibilityStatus | null;
  algorithmVersion: string;
  isLoading: boolean;
  isRefreshing: boolean;
  isActionLoading: boolean;
  error: string | null;

  fetchDiscoveryFeed: (refresh?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  nextCandidate: () => Promise<void>;
  prevCandidate: () => void;
  nextPhoto: () => void;
  prevPhoto: () => void;
  setPhotoIndex: (index: number) => void;
  recordImpression: (candidateProfileId: string, position: number) => Promise<void>;
  recordAction: (
    targetProfileId: string,
    actionType: ActionType,
    note?: string,
  ) => Promise<{ matched: boolean; match?: SafeMatch } | null>;
  undoLastPass: () => Promise<{ success: boolean; error?: string }>;
  reset: () => void;
}

export const useDiscoveryStore = create<DiscoveryState>((set, get) => ({
  candidates: [],
  currentIndex: 0,
  currentPhotoIndex: 0,
  cursor: null,
  hasMore: false,
  eligibility: null,
  algorithmVersion: 'baseline-v1',
  isLoading: false,
  isRefreshing: false,
  isActionLoading: false,
  error: null,

  fetchDiscoveryFeed: async (refresh = false) => {
    try {
      if (refresh) {
        set({ isRefreshing: true, error: null });
      } else {
        set({ isLoading: true, error: null });
      }

      const response = await apiClient.get<DiscoveryFeedResponse>('/discovery', {
        params: {
          limit: 20,
        },
      });

      const { candidates, nextCursor, hasMore, algorithmVersion, eligibility } =
        response.data;

      set({
        candidates,
        currentIndex: 0,
        currentPhotoIndex: 0,
        cursor: nextCursor,
        hasMore,
        algorithmVersion,
        eligibility,
        isLoading: false,
        isRefreshing: false,
      });

      // Automatically record impression for first candidate if available
      if (candidates.length > 0) {
        get().recordImpression(candidates[0].profileId, 0);
      }
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to load discovery candidates.';
      set({
        isLoading: false,
        isRefreshing: false,
        error: Array.isArray(errorMsg) ? errorMsg[0] : errorMsg,
      });
    }
  },

  loadMore: async () => {
    const { cursor, hasMore, isLoading, candidates } = get();
    if (!hasMore || !cursor || isLoading) return;

    try {
      set({ isLoading: true });
      const response = await apiClient.get<DiscoveryFeedResponse>('/discovery', {
        params: {
          limit: 20,
          cursor,
        },
      });

      const newCandidates = response.data.candidates;
      const nextCursor = response.data.nextCursor;
      const newHasMore = response.data.hasMore;

      // Filter out any potential duplicate candidates
      const existingIds = new Set(candidates.map((c) => c.profileId));
      const filteredNew = newCandidates.filter((c) => !existingIds.has(c.profileId));

      set({
        candidates: [...candidates, ...filteredNew],
        cursor: nextCursor,
        hasMore: newHasMore,
        isLoading: false,
      });
    } catch (_err: any) {
      set({ isLoading: false });
    }
  },

  nextCandidate: async () => {
    const { currentIndex, candidates, hasMore } = get();
    if (currentIndex < candidates.length - 1) {
      const nextIndex = currentIndex + 1;
      set({
        currentIndex: nextIndex,
        currentPhotoIndex: 0,
      });

      // Record impression for candidate
      const nextCand = candidates[nextIndex];
      get().recordImpression(nextCand.profileId, nextIndex);

      // Trigger prefetch when reaching near end of current candidate pool
      if (nextIndex >= candidates.length - 3 && hasMore) {
        get().loadMore();
      }
    }
  },

  prevCandidate: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({
        currentIndex: currentIndex - 1,
        currentPhotoIndex: 0,
      });
    }
  },

  nextPhoto: () => {
    const { candidates, currentIndex, currentPhotoIndex } = get();
    const candidate = candidates[currentIndex];
    if (candidate && candidate.photos.length > 0) {
      if (currentPhotoIndex < candidate.photos.length - 1) {
        set({ currentPhotoIndex: currentPhotoIndex + 1 });
      }
    }
  },

  prevPhoto: () => {
    const { currentPhotoIndex } = get();
    if (currentPhotoIndex > 0) {
      set({ currentPhotoIndex: currentPhotoIndex - 1 });
    }
  },

  setPhotoIndex: (index: number) => {
    set({ currentPhotoIndex: index });
  },

  recordImpression: async (candidateProfileId: string, position: number) => {
    try {
      const { algorithmVersion } = get();
      await apiClient.post<RecordImpressionResponse>('/discovery/impressions', {
        impressions: [
          {
            candidateProfileId,
            position,
            algorithmVersion,
          },
        ],
      });
    } catch (_err) {
      // Non-blocking impression logging failure
    }
  },

  recordAction: async (
    targetProfileId: string,
    actionType: ActionType,
    note?: string,
  ) => {
    const { isActionLoading, algorithmVersion } = get();
    if (isActionLoading) return null;

    set({ isActionLoading: true, error: null });

    try {
      const response = await apiClient.post<RecordActionResponse>('/actions', {
        targetProfileId,
        actionType,
        algorithmVersion,
        note,
      });

      const { matched, match } = response.data;

      // Advance to next candidate
      await get().nextCandidate();
      set({ isActionLoading: false });

      // Automatically sync coin / note balances if a direct note was sent
      if (note) {
        useBillingStore.getState().fetchCreditBalance();
      }

      return { matched, match };
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to record action. Please try again.';
      set({
        isActionLoading: false,
        error: Array.isArray(errorMsg) ? errorMsg[0] : errorMsg,
      });
      return null;
    }
  },

  undoLastPass: async () => {
    try {
      const response = await apiClient.post('/actions/undo');
      if (response.data.success) {
        useBillingStore.getState().fetchCreditBalance();
        await get().fetchDiscoveryFeed(true);
        return { success: true };
      }
      return { success: false, error: 'Failed to undo pass.' };
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        'Rewind is a Truelove Plus perk.';
      return {
        success: false,
        error: Array.isArray(errorMsg) ? errorMsg[0] : errorMsg,
      };
    }
  },

  reset: () => {
    set({
      candidates: [],
      currentIndex: 0,
      currentPhotoIndex: 0,
      cursor: null,
      hasMore: false,
      eligibility: null,
      isLoading: false,
      isRefreshing: false,
      isActionLoading: false,
      error: null,
    });
  },
}));
