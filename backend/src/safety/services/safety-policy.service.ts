import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UserStatus,
  MatchStatus,
  ProfileVisibility,
  ProfileStatus,
} from '@prisma/client';

@Injectable()
export class SafetyPolicyService {
  private readonly logger = new Logger(SafetyPolicyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves all user IDs that have either blocked or been blocked by the given user.
   * Enforces symmetric mutual safety suppression.
   */
  async getMutualBlockedUserIds(userId: string): Promise<Set<string>> {
    const blocks = await this.prisma.block.findMany({
      where: {
        OR: [{ blockerUserId: userId }, { blockedUserId: userId }],
      },
      select: {
        blockerUserId: true,
        blockedUserId: true,
      },
    });

    const blockedSet = new Set<string>();
    for (const b of blocks) {
      if (b.blockerUserId === userId) {
        blockedSet.add(b.blockedUserId);
      } else {
        blockedSet.add(b.blockerUserId);
      }
    }

    return blockedSet;
  }

  /**
   * Authoritative gate to evaluate whether two users may interact (Like, Pass, Match, Chat).
   */
  async canInteract(
    userIdA: string,
    userIdB: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (userIdA === userIdB) {
      return { allowed: false, reason: 'Self-interaction is prohibited.' };
    }

    // 1. Check mutual blocks
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerUserId: userIdA, blockedUserId: userIdB },
          { blockerUserId: userIdB, blockedUserId: userIdA },
        ],
      },
    });

    if (block) {
      return {
        allowed: false,
        reason: 'Interaction blocked by safety policy.',
      };
    }

    // 2. Check user account statuses
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: [userIdA, userIdB] },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (users.length < 2) {
      return { allowed: false, reason: 'One or more users not found.' };
    }

    const userA = users.find((u) => u.id === userIdA);
    const userB = users.find((u) => u.id === userIdB);

    if (!userA || userA.status !== UserStatus.ACTIVE) {
      return { allowed: false, reason: 'Requesting account is not active.' };
    }

    if (!userB || userB.status !== UserStatus.ACTIVE) {
      return { allowed: false, reason: 'Target account is not active.' };
    }

    return { allowed: true };
  }

  /**
   * Evaluates if a candidate profile is discoverable by the requester.
   */
  async canDiscover(
    requesterUserId: string,
    candidateUserId: string,
  ): Promise<boolean> {
    const interact = await this.canInteract(requesterUserId, candidateUserId);
    if (!interact.allowed) return false;

    // Check candidate shadowban restriction
    const candidateUser = await this.prisma.user.findUnique({
      where: { id: candidateUserId },
      select: { shadowBannedUntil: true },
    });

    if (
      candidateUser?.shadowBannedUntil &&
      candidateUser.shadowBannedUntil > new Date()
    ) {
      return false;
    }

    const candidateProfile = await this.prisma.datingProfile.findUnique({
      where: { userId: candidateUserId },
      select: { visibility: true, status: true },
    });

    if (!candidateProfile) return false;
    if (
      candidateProfile.visibility !== ProfileVisibility.VISIBLE ||
      candidateProfile.status !== ProfileStatus.READY
    ) {
      return false;
    }

    return true;
  }

  /**
   * Authoritative gate for messaging and real-time socket events.
   */
  async canMessage(
    senderUserId: string,
    recipientUserId: string,
    conversationId?: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const interact = await this.canInteract(senderUserId, recipientUserId);
    if (!interact.allowed) return interact;

    // Check sender messaging restrictions (Strike 2/3 mute cooldown)
    const sender = await this.prisma.user.findUnique({
      where: { id: senderUserId },
      select: { messagingRestrictedUntil: true },
    });

    if (
      sender?.messagingRestrictedUntil &&
      sender.messagingRestrictedUntil > new Date()
    ) {
      return {
        allowed: false,
        reason:
          'Your messaging privileges are temporarily suspended due to community safety violations.',
      };
    }

    if (conversationId) {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { match: true },
      });

      if (!conversation) {
        return { allowed: false, reason: 'Conversation not found.' };
      }

      if (conversation.match.status !== MatchStatus.ACTIVE) {
        return {
          allowed: false,
          reason: 'This match has ended. Messaging is no longer available.',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Evaluates if a user can view another user's public profile.
   */
  async canViewProfile(
    requesterUserId: string,
    targetUserId: string,
  ): Promise<boolean> {
    const interact = await this.canInteract(requesterUserId, targetUserId);
    return interact.allowed;
  }
}
