export interface Click {
  id: string;
  linkId: string;
  timestamp: Date;
  referrer: string | null;
  userAgent: string | null;
}

export interface RecordClickInput {
  linkId: string;
  referrer?: string | null;
  userAgent?: string | null;
}
