import { create } from 'zustand';
import { apiClient } from '../services/api-client';
import {
  SafeBlock,
  BlocksListResponse,
  CreateReportDto,
  SafeReport,
} from '../../../shared/src/types';

interface SafetyState {
  blockedUsers: SafeBlock[];
  nextCursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  isScreenshotModalVisible: boolean;
  showScreenshotModal: () => void;
  hideScreenshotModal: () => void;

  blockUser: (targetUserId: string, reason?: string) => Promise<boolean>;
  unblockUser: (targetUserId: string) => Promise<boolean>;
  reportUser: (dto: CreateReportDto) => Promise<boolean>;
  fetchBlockedUsers: (reset?: boolean) => Promise<void>;
  clearError: () => void;
}

export const useSafetyStore = create<SafetyState>((set, get) => ({
  blockedUsers: [],
  nextCursor: null,
  hasMore: false,
  isLoading: false,
  error: null,
  isScreenshotModalVisible: false,

  showScreenshotModal: () => set({ isScreenshotModalVisible: true }),
  hideScreenshotModal: () => set({ isScreenshotModalVisible: false }),

  blockUser: async (targetUserId: string, reason?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post<SafeBlock>(
        `/blocks/${targetUserId}`,
        { reason },
      );
      const newBlock = response.data;
      set((state) => ({
        blockedUsers: [newBlock, ...state.blockedUsers.filter((b) => b.blockedUserId !== targetUserId)],
        isLoading: false,
      }));
      return true;
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message || err.message || 'Failed to block user.';
      set({ error: errorMsg, isLoading: false });
      return false;
    }
  },

  unblockUser: async (targetUserId: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.delete(`/blocks/${targetUserId}`);
      set((state) => ({
        blockedUsers: state.blockedUsers.filter(
          (b) => b.blockedUserId !== targetUserId,
        ),
        isLoading: false,
      }));
      return true;
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message || err.message || 'Failed to unblock user.';
      set({ error: errorMsg, isLoading: false });
      return false;
    }
  },

  reportUser: async (dto: CreateReportDto) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.post<SafeReport>('/reports', dto);
      if (dto.autoBlock) {
        // Optimistically update local blocked list
        set((state) => ({
          blockedUsers: [
            {
              id: `temp-block-${Date.now()}`,
              blockedUserId: dto.targetUserId,
              createdAt: new Date().toISOString(),
            },
            ...state.blockedUsers.filter((b) => b.blockedUserId !== dto.targetUserId),
          ],
        }));
      }
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to submit report.';
      set({ error: errorMsg, isLoading: false });
      return false;
    }
  },

  fetchBlockedUsers: async (reset = false) => {
    const { nextCursor, isLoading, hasMore } = get();
    if (isLoading) return;
    if (!reset && !hasMore && nextCursor === null && get().blockedUsers.length > 0)
      return;

    set({ isLoading: true, error: null });
    try {
      const cursorParam = reset ? undefined : nextCursor;
      const response = await apiClient.get<BlocksListResponse>('/blocks', {
        params: { cursor: cursorParam, limit: 20 },
      });

      const data = response.data;
      set((state) => ({
        blockedUsers: reset
          ? data.blocks
          : [...state.blockedUsers, ...data.blocks],
        nextCursor: data.nextCursor,
        hasMore: data.hasMore,
        isLoading: false,
      }));
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        'Failed to load blocked users.';
      set({ error: errorMsg, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
