import { CreateView } from "@/components/studio/create-view";
import { getAuthUser } from "@/lib/auth-utils";
import { getUserSettings } from "@/lib/db/queries";

export default async function CreatePage() {
  const user = await getAuthUser();
  const settings = await getUserSettings(user.id);

  const userProfile = {
    name: user.name,
    email: user.email,
    image: user.image,
    headline: settings?.linkedin_headline ?? null,
  };

  return <CreateView user={userProfile} />;
}
