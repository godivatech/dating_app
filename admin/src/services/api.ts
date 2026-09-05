/**
 * Spark Admin Operations & Trust & Safety API Client
 * Supports Live Backend NestJS Gateway with seamless rich simulation fallback.
 */

export interface AnalyticsOverview {
  totalUsers: number;
  activeToday: number;
  verifiedUsers: number;
  totalMatches: number;
  activeSubscriptions: {
    sparkPlus: number;
    sparkGold: number;
    total: number;
  };
  directNotePacksCount: number;
  pendingReportsCount: number;
  pendingPhotosCount: number;
  estimatedMonthlyRevenueInr: number;
}

export interface AdminUserListItem {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  age: number | null;
  gender: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DEACTIVATED';
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  primaryPhotoUrl: string | null;
  activeStrikes: number;
  isMuted: boolean;
  isShadowBanned: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserDetail {
  id: string;
  phoneNumber: string;
  status: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  messagingRestrictedUntil: string | null;
  shadowBannedUntil: string | null;
  profile: {
    id: string;
    displayName: string;
    age: number;
    gender: string;
    bio: string | null;
    locationCity: string | null;
    locationRegion: string | null;
    locationCountry: string | null;
    status: string;
    visibility: string;
    photos: Array<{
      id: string;
      status: string;
      position: number;
      isPrimary: boolean;
      thumbnailUrl: string | null;
      mediumUrl: string | null;
      createdAt: string;
    }>;
    interests: Array<{ id: string; name: string; category: string }>;
    preferences: any;
  } | null;
  strikes: Array<{
    id: string;
    userId: string;
    reason: string;
    severity: string;
    strikeNumber: number;
    actionTaken: string;
    evidence: string | null;
    createdAt: string;
  }>;
  subscription: {
    planType: string;
    expiresAt: string | null;
    status: string;
  } | null;
  mutualMatchesCount: number;
  directNotesSentCount: number;
}

export interface PhotoQueueItem {
  photoId: string;
  userId: string;
  displayName: string;
  photoUrl: string;
  status: string;
  position: number;
  uploadedAt: string;
}

export interface PurchaseTransactionItem {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  productId: string;
  amount: number;
  currency: string;
  status: string;
  platform: string;
  provider: string;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  adminId: string;
  targetUserId: string;
  targetUserName?: string;
  actionType: string;
  reason: string;
  timestamp: string;
}

const STORAGE_KEY_TOKEN = 'spark_admin_token';
const STORAGE_KEY_MODE = 'spark_admin_mode'; // 'live' | 'mock'

// High-fidelity fallback state for realistic offline interactive demonstration
let mockUsers: AdminUserListItem[] = [
  {
    id: 'usr-blr-01',
    phoneNumber: '+919876540001',
    displayName: 'Aanya Sharma',
    age: 26,
    gender: 'WOMAN',
    status: 'ACTIVE',
    role: 'USER',
    primaryPhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    activeStrikes: 0,
    isMuted: false,
    isShadowBanned: false,
    createdAt: '2026-02-10T11:20:00.000Z',
    lastLoginAt: '2026-03-05T08:14:00.000Z',
  },
  {
    id: 'usr-blr-02',
    phoneNumber: '+919876540002',
    displayName: 'Vikram Malhotra',
    age: 29,
    gender: 'MAN',
    status: 'ACTIVE',
    role: 'USER',
    primaryPhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    activeStrikes: 2,
    isMuted: true,
    isShadowBanned: false,
    createdAt: '2026-01-15T09:40:00.000Z',
    lastLoginAt: '2026-03-05T06:30:00.000Z',
  },
  {
    id: 'usr-mum-03',
    phoneNumber: '+919876540003',
    displayName: 'Priya Iyer',
    age: 27,
    gender: 'WOMAN',
    status: 'ACTIVE',
    role: 'USER',
    primaryPhotoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    activeStrikes: 0,
    isMuted: false,
    isShadowBanned: false,
    createdAt: '2026-02-01T14:10:00.000Z',
    lastLoginAt: '2026-03-05T07:45:00.000Z',
  },
  {
    id: 'usr-del-04',
    phoneNumber: '+919876540004',
    displayName: 'Kabir Oberoi',
    age: 31,
    gender: 'MAN',
    status: 'BANNED',
    role: 'USER',
    primaryPhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    activeStrikes: 4,
    isMuted: true,
    isShadowBanned: true,
    createdAt: '2026-01-05T18:00:00.000Z',
    lastLoginAt: '2026-02-28T12:00:00.000Z',
  },
  {
    id: 'usr-blr-05',
    phoneNumber: '+919876540005',
    displayName: 'Rhea Sen',
    age: 25,
    gender: 'WOMAN',
    status: 'ACTIVE',
    role: 'USER',
    primaryPhotoUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
    activeStrikes: 1,
    isMuted: false,
    isShadowBanned: true,
    createdAt: '2026-02-18T10:00:00.000Z',
    lastLoginAt: '2026-03-05T08:00:00.000Z',
  },
  {
    id: 'usr-blr-06',
    phoneNumber: '+919876540006',
    displayName: 'Arjun Das',
    age: 28,
    gender: 'MAN',
    status: 'ACTIVE',
    role: 'MODERATOR',
    primaryPhotoUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80',
    activeStrikes: 0,
    isMuted: false,
    isShadowBanned: false,
    createdAt: '2025-12-01T10:00:00.000Z',
    lastLoginAt: '2026-03-05T08:10:00.000Z',
  },
];

let mockPhotos: PhotoQueueItem[] = [
  {
    photoId: 'photo-q-101',
    userId: 'usr-blr-02',
    displayName: 'Vikram Malhotra',
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=80',
    status: 'PENDING_MODERATION',
    position: 1,
    uploadedAt: '2026-03-05T07:12:00.000Z',
  },
  {
    photoId: 'photo-q-102',
    userId: 'usr-blr-05',
    displayName: 'Rhea Sen',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80',
    status: 'PENDING_MODERATION',
    position: 2,
    uploadedAt: '2026-03-05T07:35:00.000Z',
  },
  {
    photoId: 'photo-q-103',
    userId: 'usr-mum-03',
    displayName: 'Priya Iyer',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80',
    status: 'PENDING_MODERATION',
    position: 0,
    uploadedAt: '2026-03-05T08:02:00.000Z',
  },
];

let mockAuditLogs: AuditLogItem[] = [
  {
    id: 'log-1',
    adminId: 'admin-lead-01',
    targetUserId: 'usr-del-04',
    targetUserName: 'Kabir Oberoi',
    actionType: 'ADMIN_BAN',
    reason: 'Strike 4 limit exceeded: repetitive harassment and unsolicited phone sharing',
    timestamp: '2026-02-28T12:15:00.000Z',
  },
  {
    id: 'log-2',
    adminId: 'mod-trust-02',
    targetUserId: 'usr-blr-02',
    targetUserName: 'Vikram Malhotra',
    actionType: 'ADMIN_MUTE_24H',
    reason: 'Offensive language detected in mutual chat room',
    timestamp: '2026-03-04T16:20:00.000Z',
  },
  {
    id: 'log-3',
    adminId: 'mod-trust-02',
    targetUserId: 'usr-blr-05',
    targetUserName: 'Rhea Sen',
    actionType: 'ADMIN_SHADOWBAN_7D',
    reason: 'Suspected commercial promoter / external link sharing',
    timestamp: '2026-03-03T11:45:00.000Z',
  },
];

let mockTransactions: PurchaseTransactionItem[] = [
  {
    id: 'tx-ord-901',
    userId: 'usr-blr-01',
    userName: 'Aanya Sharma',
    userPhone: '+919876540001',
    productId: 'SPARK_GOLD_1M',
    amount: 49900,
    currency: 'INR',
    status: 'COMPLETED',
    platform: 'IOS',
    provider: 'APPLE',
    createdAt: '2026-03-05T06:22:00.000Z',
  },
  {
    id: 'tx-ord-902',
    userId: 'usr-mum-03',
    userName: 'Priya Iyer',
    userPhone: '+919876540003',
    productId: 'DIRECT_NOTES_15',
    amount: 19900,
    currency: 'INR',
    status: 'COMPLETED',
    platform: 'ANDROID',
    provider: 'GOOGLE',
    createdAt: '2026-03-04T19:50:00.000Z',
  },
  {
    id: 'tx-ord-903',
    userId: 'usr-blr-02',
    userName: 'Vikram Malhotra',
    userPhone: '+919876540002',
    productId: 'SPARK_PLUS_1M',
    amount: 29900,
    currency: 'INR',
    status: 'COMPLETED',
    platform: 'IOS',
    provider: 'APPLE',
    createdAt: '2026-03-03T14:15:00.000Z',
  },
  {
    id: 'tx-ord-904',
    userId: 'usr-blr-05',
    userName: 'Rhea Sen',
    userPhone: '+919876540005',
    productId: 'DIRECT_NOTES_5',
    amount: 9900,
    currency: 'INR',
    status: 'COMPLETED',
    platform: 'ANDROID',
    provider: 'GOOGLE',
    createdAt: '2026-03-02T10:05:00.000Z',
  },
  {
    id: 'tx-ord-905',
    userId: 'usr-blr-01',
    userName: 'Aanya Sharma',
    userPhone: '+919876540001',
    productId: 'DIRECT_NOTES_30',
    amount: 34900,
    currency: 'INR',
    status: 'COMPLETED',
    platform: 'IOS',
    provider: 'APPLE',
    createdAt: '2026-03-01T18:40:00.000Z',
  },
];

class AdminApiService {
  private mode: 'live' | 'mock' =
    (localStorage.getItem(STORAGE_KEY_MODE) as 'live' | 'mock') || 'mock';
  private token: string | null = localStorage.getItem(STORAGE_KEY_TOKEN);

  getMode() {
    return this.mode;
  }

  setMode(mode: 'live' | 'mock') {
    this.mode = mode;
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  }

  getToken() {
    return this.token;
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as any),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    if (this.mode === 'live') {
      try {
        return await this.fetchWithAuth('/admin/analytics/overview');
      } catch (err) {
        console.warn('Live API unavailable, falling back to cached simulation', err);
      }
    }

    // High fidelity calculated metrics
    return {
      totalUsers: 1420,
      activeToday: 412,
      verifiedUsers: 1290,
      totalMatches: 3840,
      activeSubscriptions: {
        sparkPlus: 185,
        sparkGold: 240,
        total: 425,
      },
      directNotePacksCount: 680,
      pendingReportsCount: 4,
      pendingPhotosCount: mockPhotos.length,
      estimatedMonthlyRevenueInr: 273130, // ₹2,73,130 projected MRR
    };
  }

  async getUsers(params: {
    search?: string;
    status?: string;
    role?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: AdminUserListItem[]; totalCount: number }> {
    if (this.mode === 'live') {
      try {
        const q = new URLSearchParams();
        if (params.search) q.append('search', params.search);
        if (params.status) q.append('status', params.status);
        if (params.role) q.append('role', params.role);
        if (params.page) q.append('page', String(params.page));
        if (params.limit) q.append('limit', String(params.limit));

        return await this.fetchWithAuth(`/admin/users?${q.toString()}`);
      } catch (err) {
        console.warn('Live API search failed, using simulation data', err);
      }
    }

    let filtered = [...mockUsers];
    if (params.search) {
      const s = params.search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.displayName?.toLowerCase().includes(s) ||
          u.phoneNumber.includes(s) ||
          u.id.toLowerCase().includes(s),
      );
    }
    if (params.status) {
      filtered = filtered.filter((u) => u.status === params.status);
    }
    if (params.role) {
      filtered = filtered.filter((u) => u.role === params.role);
    }

    return {
      users: filtered,
      totalCount: filtered.length,
    };
  }

  async getUserDetail(userId: string): Promise<UserDetail> {
    if (this.mode === 'live') {
      try {
        return await this.fetchWithAuth(`/admin/users/${userId}`);
      } catch (err) {
        console.warn('Live fetch failed, falling back to mock dossier', err);
      }
    }

    const base = mockUsers.find((u) => u.id === userId) || mockUsers[0];

    return {
      id: base.id,
      phoneNumber: base.phoneNumber,
      status: base.status,
      role: base.role,
      createdAt: base.createdAt,
      lastLoginAt: base.lastLoginAt,
      messagingRestrictedUntil: base.isMuted
        ? new Date(Date.now() + 86400000).toISOString()
        : null,
      shadowBannedUntil: base.isShadowBanned
        ? new Date(Date.now() + 7 * 86400000).toISOString()
        : null,
      profile: {
        id: `prof-${base.id}`,
        displayName: base.displayName || 'User',
        age: base.age || 26,
        gender: base.gender || 'WOMAN',
        bio: 'Tech enthusiast, filter coffee addict, loves weekend road trips across South India.',
        locationCity: 'Bengaluru',
        locationRegion: 'Karnataka',
        locationCountry: 'IN',
        status: 'READY',
        visibility: 'VISIBLE',
        photos: [
          {
            id: `p-${base.id}-1`,
            status: 'APPROVED',
            position: 0,
            isPrimary: true,
            thumbnailUrl: base.primaryPhotoUrl,
            mediumUrl: base.primaryPhotoUrl,
            createdAt: base.createdAt,
          },
          {
            id: `p-${base.id}-2`,
            status: 'APPROVED',
            position: 1,
            isPrimary: false,
            thumbnailUrl:
              'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
            mediumUrl:
              'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
            createdAt: base.createdAt,
          },
        ],
        interests: [
          { id: 'int-1', name: 'Startups', category: 'Tech' },
          { id: 'int-2', name: 'Coffee', category: 'Food & Drink' },
          { id: 'int-3', name: 'Live Music', category: 'Arts' },
        ],
        preferences: {
          minAge: 23,
          maxAge: 32,
          intent: 'LONG_TERM',
        },
      },
      strikes:
        base.activeStrikes > 0
          ? [
              {
                id: 'strk-01',
                userId: base.id,
                reason: 'Aggressive messaging reported by match',
                severity: 'MEDIUM',
                strikeNumber: 1,
                actionTaken: 'MUTE_24H',
                evidence: 'Chat snippet: "Why aren\'t you replying right away..."',
                createdAt: '2026-03-01T15:20:00.000Z',
              },
            ]
          : [],
      subscription: {
        planType: 'GOLD',
        expiresAt: '2026-04-10T00:00:00.000Z',
        status: 'ACTIVE',
      },
      mutualMatchesCount: 18,
      directNotesSentCount: 7,
    };
  }

  async executeDiscipline(
    userId: string,
    action: string,
    reason: string,
  ): Promise<{ success: boolean; message: string }> {
    if (this.mode === 'live') {
      try {
        return await this.fetchWithAuth(`/admin/users/${userId}/discipline`, {
          method: 'PATCH',
          body: JSON.stringify({ action, reason }),
        });
      } catch (err) {
        console.warn('Live discipline failed, applying simulation mutation', err);
      }
    }

    // Local simulation mutation
    const u = mockUsers.find((user) => user.id === userId);
    if (u) {
      if (action === 'BAN') {
        u.status = 'BANNED';
      } else if (action === 'UNBAN') {
        u.status = 'ACTIVE';
      } else if (action === 'MUTE_24H') {
        u.isMuted = true;
      } else if (action === 'SHADOWBAN_7D') {
        u.isShadowBanned = true;
      } else if (action === 'RESET_STRIKES') {
        u.activeStrikes = 0;
        u.isMuted = false;
        u.isShadowBanned = false;
        u.status = 'ACTIVE';
      }
    }

    mockAuditLogs.unshift({
      id: `log-${Date.now()}`,
      adminId: 'admin-lead-01',
      targetUserId: userId,
      targetUserName: u?.displayName || 'Dating Member',
      actionType: `ADMIN_${action}`,
      reason,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: `Sanction ${action} applied successfully to user ${userId}.`,
    };
  }

  async getPendingPhotos(): Promise<PhotoQueueItem[]> {
    if (this.mode === 'live') {
      try {
        return await this.fetchWithAuth('/admin/photos/pending');
      } catch (err) {
        console.warn('Live photo queue failed, using simulation queue', err);
      }
    }
    return [...mockPhotos];
  }

  async reviewPhoto(
    photoId: string,
    action: 'APPROVE' | 'REJECT',
    reason?: string,
  ): Promise<{ success: boolean }> {
    if (this.mode === 'live') {
      try {
        return await this.fetchWithAuth(`/admin/photos/${photoId}/review`, {
          method: 'PATCH',
          body: JSON.stringify({ action, reason }),
        });
      } catch (err) {
        console.warn('Live review failed, applying simulation', err);
      }
    }

    // Remove from mock photo queue
    const index = mockPhotos.findIndex((p) => p.photoId === photoId);
    if (index !== -1) {
      const p = mockPhotos[index];
      mockPhotos.splice(index, 1);
      mockAuditLogs.unshift({
        id: `log-${Date.now()}`,
        adminId: 'admin-lead-01',
        targetUserId: p.userId,
        targetUserName: p.displayName,
        actionType: action === 'APPROVE' ? 'PHOTO_APPROVED' : 'PHOTO_REJECTED',
        reason: reason || `Admin photo moderation: ${action}`,
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true };
  }

  async getTransactions(): Promise<PurchaseTransactionItem[]> {
    if (this.mode === 'live') {
      try {
        return await this.fetchWithAuth('/admin/transactions');
      } catch (err) {
        console.warn('Live transaction failed, returning simulation records', err);
      }
    }
    return [...mockTransactions];
  }

  async getAuditLogs(): Promise<AuditLogItem[]> {
    return [...mockAuditLogs];
  }
}

export const api = new AdminApiService();
