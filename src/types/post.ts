export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export interface Post {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  scheduledAt?: Date;
  publishedAt?: Date;
  status: PostStatus;
  linkedinPostUrn?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Draft extends Omit<Post, "scheduledAt" | "publishedAt"> {
  status: "draft";
  characterCount: number;
}
