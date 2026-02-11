export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export interface Post {
  id: string;
  userId: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  scheduledAt?: Date;
  publishedAt?: Date;
  status: PostStatus;
  linkedinPostUrn?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Draft extends Omit<Post, "scheduledAt" | "publishedAt"> {
  status: "draft";
  characterCount: number;
}
