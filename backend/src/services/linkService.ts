import { Prisma } from '@prisma/client';
import { linkRepository } from '../repositories/linkRepository.js';
import { generateRandomCode } from '../utils/codeGenerator.js';
import type { CreateLinkInput, Link } from '../domain/link.js';

const MAX_CODE_GENERATION_ATTEMPTS = 5;

export class AliasTakenError extends Error {
  constructor(alias: string) {
    super(`Alias "${alias}" is already taken`);
    this.name = 'AliasTakenError';
  }
}

export class CodeGenerationExhaustedError extends Error {
  constructor() {
    super('Could not generate a unique short code after multiple attempts');
    this.name = 'CodeGenerationExhaustedError';
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export const linkService = {
  async createLink(input: CreateLinkInput, shortCodeLength: number): Promise<Link> {
    const expiresAt = input.expiresAt ?? null;

    if (input.alias) {
      try {
        return await linkRepository.create({ code: input.alias, url: input.url, expiresAt });
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          throw new AliasTakenError(input.alias);
        }
        throw error;
      }
    }

    // Alias collisions on randomly generated codes are rare but possible; retry a bounded
    // number of times before giving up rather than looping forever on a pathological case.
    for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
      const code = generateRandomCode(shortCodeLength);
      try {
        return await linkRepository.create({ code, url: input.url, expiresAt });
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new CodeGenerationExhaustedError();
  },

  async getByCode(code: string): Promise<Link | null> {
    return linkRepository.findByCode(code);
  },

  isExpired(link: Link): boolean {
    return link.expiresAt !== null && link.expiresAt.getTime() <= Date.now();
  },

  // Cache TTL is derived so that non-expiring links use the configured default, while
  // expiring links self-evict from the cache at the exact moment they expire.
  getCacheTtlSeconds(link: Link, defaultTtlSeconds: number): number {
    if (link.expiresAt === null) {
      return defaultTtlSeconds;
    }
    const secondsRemaining = Math.floor((link.expiresAt.getTime() - Date.now()) / 1000);
    return Math.max(secondsRemaining, 1);
  },
};
