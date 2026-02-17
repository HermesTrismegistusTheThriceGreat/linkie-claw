import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function getAuthUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return {
    ...session.user,
    id: session.user.id,
  } as { id: string; name?: string | null; email?: string | null; image?: string | null };
}

export async function getAuthUserId(): Promise<string> {
  const user = await getAuthUser();
  return user.id;
}
