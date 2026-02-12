import { AuroraBackground } from "@/components/layout/aurora-background";
import { Sidebar } from "@/components/layout/sidebar";
import { getAuthUser } from "@/lib/auth-utils";
import { getUserVoiceTones } from "@/lib/db/queries";
import { VoiceTonesEditor } from "@/components/voice-tones/voice-tones-editor";
import { updateVoiceTones, resetVoiceTones } from "./actions";

export default async function VoiceTonesPage() {
    const user = await getAuthUser();
    const voiceTones = await getUserVoiceTones(user.id);

    return (
        <AuroraBackground className="min-h-screen">
            <div className="flex">
                <Sidebar user={user} />
                <main className="flex-1 overflow-y-auto z-10">
                    <div className="max-w-5xl mx-auto p-10 space-y-8">
                        <div>
                            <h1 className="text-4xl font-bold">Voice & Tones</h1>
                            <p className="text-slate-500 mt-2">
                                Customize the AI prompts that generate your LinkedIn post variations.
                                Each style defines a different voice for your content.
                            </p>
                        </div>
                        <VoiceTonesEditor
                            initialTones={voiceTones}
                            onSave={updateVoiceTones}
                            onReset={resetVoiceTones}
                        />
                    </div>
                </main>
            </div>
        </AuroraBackground>
    );
}
