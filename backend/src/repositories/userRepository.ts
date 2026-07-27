import { prisma } from '../lib/prisma.js';
import type { User } from '../domain/user.js';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export const userRepository = {
  // Returning users are updated in place (name/avatar/email can change on Google's side);
  // new users are created keyed by the immutable `sub` claim (googleId).
  async upsertByGoogleId(profile: GoogleProfile): Promise<User> {
    return prisma.user.upsert({
      where: { googleId: profile.googleId },
      create: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      },
      update: {
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      },
    });
  },

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },
};
