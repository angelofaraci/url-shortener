export interface Link {
  id: string;
  code: string;
  url: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface CreateLinkInput {
  url: string;
  alias?: string;
  expiresAt?: Date;
}
