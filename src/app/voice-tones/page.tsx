import { AuroraBackground } from "@/components/layout/aurora-background";
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
                <VoiceTonesEditor
                    initialTones={voiceTones}
                    onSave={updateVoiceTones}
                    onReset={resetVoiceTones}
                    user={user}
                />
            </div>
        </AuroraBackground>
    );
}
