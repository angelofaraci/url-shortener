export interface Link {
  id: string;
  code: string;
  url: string;
  expiresAt: Date | null;
  createdAt: Date;
  userId: string | null;
}

export interface CreateLinkInput {
  url: string;
  alias?: string;
  expiresAt?: Date;
  userId?: string | null;
}
