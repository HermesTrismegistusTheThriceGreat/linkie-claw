import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <div className="flex flex-wrap justify-between items-end gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 text-[#ee5b2b]">
          <span className="material-symbols-outlined text-4xl">history_edu</span>
          <h1 className="text-[#333333] text-4xl font-black leading-tight tracking-tight">
            Create Your Post
          </h1>
        </div>
        <p className="text-gray-500 text-lg font-normal">
          Use AI to craft the perfect LinkedIn presence
        </p>
      </div>

      <Button
        variant="outline"
        className="flex items-center gap-2 rounded-full h-11 px-6 bg-white border border-gray-200 text-[#333333] text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
      >
        <span className="material-symbols-outlined text-lg">settings</span>
        <span>Post Settings</span>
      </Button>
    </div>
  );
}
