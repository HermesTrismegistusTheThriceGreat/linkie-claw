import { AuroraBackground } from "@/components/layout/aurora-background";
import { getAuthUser } from "@/lib/auth-utils";
import { getUserImageStyles } from "@/lib/db/queries";
import { ImageStylesEditor } from "@/components/image-styles/image-styles-editor";
import { updateImageStyles, resetImageStyles } from "./actions";

export default async function ImageStylesPage() {
    const user = await getAuthUser();
    const imageStyles = await getUserImageStyles(user.id);

    return (
        <AuroraBackground className="min-h-screen">
            <div className="flex">
                <ImageStylesEditor
                    initialStyles={imageStyles}
                    onSave={updateImageStyles}
                    onReset={resetImageStyles}
                    user={user}
                />
            </div>
        </AuroraBackground>
    );
}
