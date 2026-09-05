import { create } from 'zustand';
import { apiClient } from '../services/api-client';
import {
  SafeDatingProfile,
  SafeProfilePhoto,
  ProfileCompletionResult,
  Interest,
  UpdateIdentityDto,
  UpdatePreferencesDto,
  UpdateInterestsDto,
  UpdateAboutLocationDto,
  RequestPhotoUploadResponse,
  ProfileVisibility,
} from '../../../shared/src/types';

interface ProfileState {
  profile: SafeDatingProfile | null;
  completion: ProfileCompletionResult | null;
  referenceInterests: Interest[];
  isLoading: boolean;
  isUploadingPhoto: boolean;
  error: string | null;

  // Profile Lifecycle Actions
  fetchProfile: () => Promise<SafeDatingProfile | null>;
  fetchReferenceInterests: () => Promise<Interest[]>;
  saveIdentity: (dto: UpdateIdentityDto) => Promise<boolean>;
  savePreferences: (dto: UpdatePreferencesDto) => Promise<boolean>;
  saveInterests: (dto: UpdateInterestsDto) => Promise<boolean>;
  saveAboutLocation: (dto: UpdateAboutLocationDto) => Promise<boolean>;
  toggleVisibility: (visibility: ProfileVisibility) => Promise<boolean>;

  // Photo Management Actions
  uploadPhoto: (
    uri: string,
    mimeType: string,
    fileSize: number,
  ) => Promise<boolean>;
  setPrimaryPhoto: (photoId: string) => Promise<boolean>;
  reorderPhotos: (photoIds: string[]) => Promise<boolean>;
  deletePhoto: (photoId: string) => Promise<boolean>;

  clearError: () => void;
  resetProfile: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  completion: null,
  referenceInterests: [],
  isLoading: false,
  isUploadingPhoto: false,
  error: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const [profileRes, completionRes] = await Promise.all([
        apiClient.get<SafeDatingProfile>('/profile/me'),
        apiClient.get<ProfileCompletionResult>('/profile/completion'),
      ]);

      const profile = profileRes.data?.id ? profileRes.data : null;
      set({
        profile,
        completion: completionRes.data,
        isLoading: false,
        error: null,
      });
      return profile;
    } catch (err: any) {
      set({
        profile: null,
        isLoading: false,
        error: err.response?.data?.message || 'Failed to fetch profile',
      });
      return null;
    }
  },

  fetchReferenceInterests: async () => {
    try {
      const res = await apiClient.get<Interest[]>('/interests');
      set({ referenceInterests: res.data });
      return res.data;
    } catch {
      return get().referenceInterests;
    }
  },

  saveIdentity: async (dto: UpdateIdentityDto) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.put<SafeDatingProfile>(
        '/profile/identity',
        dto,
      );
      const completionRes = await apiClient.get<ProfileCompletionResult>(
        '/profile/completion',
      );
      set({
        profile: res.data,
        completion: completionRes.data,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      const message =
        err.response?.data?.message || 'Failed to save identity details';
      set({
        error: typeof message === 'string' ? message : message[0],
        isLoading: false,
      });
      return false;
    }
  },

  savePreferences: async (dto: UpdatePreferencesDto) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.put<SafeDatingProfile>(
        '/profile/preferences',
        dto,
      );
      const completionRes = await apiClient.get<ProfileCompletionResult>(
        '/profile/completion',
      );
      set({
        profile: res.data,
        completion: completionRes.data,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      const message =
        err.response?.data?.message || 'Failed to save preferences';
      set({
        error: typeof message === 'string' ? message : message[0],
        isLoading: false,
      });
      return false;
    }
  },

  saveInterests: async (dto: UpdateInterestsDto) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.put<SafeDatingProfile>(
        '/profile/interests',
        dto,
      );
      const completionRes = await apiClient.get<ProfileCompletionResult>(
        '/profile/completion',
      );
      set({
        profile: res.data,
        completion: completionRes.data,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      const message =
        err.response?.data?.message || 'Failed to save interests';
      set({
        error: typeof message === 'string' ? message : message[0],
        isLoading: false,
      });
      return false;
    }
  },

  saveAboutLocation: async (dto: UpdateAboutLocationDto) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.put<SafeDatingProfile>(
        '/profile/about-location',
        dto,
      );
      const completionRes = await apiClient.get<ProfileCompletionResult>(
        '/profile/completion',
      );
      set({
        profile: res.data,
        completion: completionRes.data,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      const message =
        err.response?.data?.message || 'Failed to save bio and location';
      set({
        error: typeof message === 'string' ? message : message[0],
        isLoading: false,
      });
      return false;
    }
  },

  toggleVisibility: async (visibility: ProfileVisibility) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.patch<SafeDatingProfile>(
        '/profile/visibility',
        { visibility },
      );
      set({
        profile: res.data,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      const message =
        err.response?.data?.message || 'Failed to update visibility';
      set({
        error: typeof message === 'string' ? message : message[0],
        isLoading: false,
      });
      return false;
    }
  },

  uploadPhoto: async (uri: string, mimeType: string, fileSize: number) => {
    set({ isUploadingPhoto: true, error: null });
    try {
      // 1. Request presigned upload URL
      const urlRes = await apiClient.post<RequestPhotoUploadResponse>(
        '/profile/photos/upload-url',
        { mimeType, fileSize },
      );

      const { photoId, uploadUrl } = urlRes.data;

      // 2. Read local image file as blob
      const fileFetch = await fetch(uri);
      const blob = await fileFetch.blob();

      // 3. Direct upload to Cloudflare R2 presigned URL
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        body: blob,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload image directly to storage.');
      }

      // 4. Complete upload on backend to enqueue async processing
      await apiClient.post(`/profile/photos/${photoId}/complete`);

      // 5. Refresh profile state
      await get().fetchProfile();
      set({ isUploadingPhoto: false, error: null });
      return true;
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || 'Failed to upload photo';
      set({
        error: typeof message === 'string' ? message : message[0],
        isUploadingPhoto: false,
      });
      return false;
    }
  },

  setPrimaryPhoto: async (photoId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.patch<SafeProfilePhoto[]>(
        `/profile/photos/${photoId}/primary`,
      );
      if (get().profile) {
        set({
          profile: {
            ...get().profile!,
            photos: res.data,
          },
          isLoading: false,
        });
      }
      return true;
    } catch (err: any) {
      const message =
        err.response?.data?.message || 'Failed to set primary photo';
      set({
        error: typeof message === 'string' ? message : message[0],
        isLoading: false,
      });
      return false;
    }
  },

  reorderPhotos: async (photoIds: string[]) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.patch<SafeProfilePhoto[]>(
        '/profile/photos/reorder',
        { photoIds },
      );
      if (get().profile) {
        set({
          profile: {
            ...get().profile!,
            photos: res.data,
          },
          isLoading: false,
        });
      }
      return true;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to reorder photos';
      set({
        error: typeof message === 'string' ? message : message[0],
        isLoading: false,
      });
      return false;
    }
  },

  deletePhoto: async (photoId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.delete<SafeProfilePhoto[]>(
        `/profile/photos/${photoId}`,
      );
      if (get().profile) {
        set({
          profile: {
            ...get().profile!,
            photos: res.data,
          },
          isLoading: false,
        });
      }
      await get().fetchProfile();
      return true;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to delete photo';
      set({
        error: typeof message === 'string' ? message : message[0],
        isLoading: false,
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),

  resetProfile: () =>
    set({
      profile: null,
      completion: null,
      error: null,
      isLoading: false,
      isUploadingPhoto: false,
    }),
}));
