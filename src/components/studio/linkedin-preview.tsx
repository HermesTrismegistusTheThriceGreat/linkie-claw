interface LinkedInPreviewProps {
  content: string | null;
  imageUrl: string | null;
  userName?: string;
  userHeadline?: string;
  userAvatar?: string;
}

export function LinkedInPreview({
  content,
  imageUrl,
  userName = "Alex Rivers",
  userHeadline = "Founder @ Aurora AI | Crafting the future of SaaS | Ex-Google",
  userAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuAnQ7hhbFrNZpJ8QUT0Zkig7DjX7IjB6Bl48xxznB9iWIqbDKjpgyWZ06-G34S2urzF5X_ATwTKKRqWMq4ifupYYU9QXTYTPHfiJ4IAOKFz9pIId5cn-Qhu0AfOHQiL_nqXc_VmdK2E94Vw5wfFtfLR4Nl7VaQJoD8VrjKejd3bT_fg-HQ-hsOOreBSbHM0XDsTFBQB6AivU6Cfp6Brp2K0x5MRLa-tJ6mp5r0vVcNEZgMK3A1MSfWOQ5RuQCgtezwWCTOQlZ98jjw",
}: LinkedInPreviewProps) {
  const displayContent = content || "Your post content will appear here...";
  const isPlaceholder = !content;

  return (
    <div className="space-y-4" data-testid="writer-linkedin-preview">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
          Live Preview
        </h3>
        <span className="flex items-center gap-1 text-xs text-[#ee5b2b]">
          <span className="size-2 animate-pulse rounded-full bg-[#ee5b2b]"></span>
          LinkedIn Feed
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white text-slate-900 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
        <div className="flex gap-3 p-4">
          <div
            className="size-12 rounded-full bg-cover bg-center shadow-inner"
            style={{ backgroundImage: `url("${userAvatar}")` }}
          />
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-1">
              <span className="cursor-pointer text-sm font-bold text-[#333333] hover:text-blue-600 hover:underline">
                {userName}
              </span>
              <span className="text-xs font-normal text-gray-500">• 1st</span>
            </div>
            <p className="text-[11px] leading-tight text-gray-500">
              {userHeadline}
            </p>
            <div className="flex items-center gap-1 text-gray-400">
              <span className="text-[11px]">Just now •</span>
              <span className="material-symbols-outlined text-[14px]">
                public
              </span>
            </div>
          </div>
          <button className="material-symbols-outlined text-gray-400">
            more_horiz
          </button>
        </div>

        <div className="space-y-3 px-4 pb-3">
          <p
            className={`whitespace-pre-wrap text-sm leading-relaxed ${isPlaceholder ? "text-gray-400 italic" : "text-[#333333]"
              }`}
          >
            {displayContent}
          </p>
          {!isPlaceholder && displayContent.length > 200 && (
            <p className="cursor-pointer text-sm font-semibold text-blue-600">
              ...see more
            </p>
          )}
        </div>

        {imageUrl && (
          <div className="aspect-video w-full border-y border-gray-50 bg-gray-50">
            <img
              className="h-full w-full object-cover"
              src={imageUrl}
              alt="Post image"
            />
          </div>
        )}

        <div className="flex items-center justify-between border-b border-gray-50 p-2 px-4">
          <div className="-space-x-1 flex">
            <div className="flex size-4 items-center justify-center rounded-full border border-white bg-blue-500">
              <span className="material-symbols-outlined text-[10px] text-white">
                thumb_up
              </span>
            </div>
            <div className="flex size-4 items-center justify-center rounded-full border border-white bg-red-500">
              <span className="material-symbols-outlined text-[10px] text-white">
                favorite
              </span>
            </div>
          </div>
          <span className="text-xs text-gray-400">2,492 comments</span>
        </div>

        <div className="flex justify-between p-1 px-2 text-gray-400">
          <button className="flex items-center gap-1.5 rounded p-2 transition-colors hover:bg-gray-50">
            <span className="material-symbols-outlined text-xl">thumb_up</span>
            <span className="text-xs font-bold">Like</span>
          </button>
          <button className="flex items-center gap-1.5 rounded p-2 transition-colors hover:bg-gray-50">
            <span className="material-symbols-outlined text-xl">comment</span>
            <span className="text-xs font-bold">Comment</span>
          </button>
          <button className="flex items-center gap-1.5 rounded p-2 transition-colors hover:bg-gray-50">
            <span className="material-symbols-outlined text-xl">share</span>
            <span className="text-xs font-bold">Share</span>
          </button>
          <button className="flex items-center gap-1.5 rounded p-2 transition-colors hover:bg-gray-50">
            <span className="material-symbols-outlined text-xl">send</span>
            <span className="text-xs font-bold">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
