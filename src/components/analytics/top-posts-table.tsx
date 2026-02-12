interface TopPost {
  id: string;
  title: string;
  content: string;
  published_at: Date | null;
  linkedin_post_urn: string | null;
}

interface TopPostsTableProps {
  posts: TopPost[];
}

export function TopPostsTable({ posts }: TopPostsTableProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return "Unknown";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const truncateContent = (content: string, maxLength: number = 80) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + "...";
  };

  return (
    <div
      data-testid="analytics-top-posts"
      className="glass-card rounded-2xl p-6 border border-white/50"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold">Recent Published Posts</h2>
          <p className="text-sm text-muted-foreground">
            Your most recent published content
          </p>
        </div>
        <span className="material-symbols-outlined text-muted-foreground">
          format_list_bulleted
        </span>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No published posts yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              data-testid={`analytics-post-${post.id}`}
              className="p-4 bg-white/30 rounded-xl hover:bg-white/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm mb-1 truncate">
                    {post.title || "Untitled Post"}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {truncateContent(post.content)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {formatDate(post.published_at)}
                  </p>
                  {post.linkedin_post_urn && (
                    <a
                      href={`https://www.linkedin.com/feed/update/${post.linkedin_post_urn}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`analytics-post-link-${post.id}`}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      <span className="material-symbols-outlined text-sm">
                        open_in_new
                      </span>
                      View on LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
