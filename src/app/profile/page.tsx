import { redirect } from "next/navigation";
import { ProfileForm } from "~/components/account/ProfileForm";
import { auth } from "~/server/auth";
import { nonIndexableMetadata } from "~/lib/indexing";

export const metadata = nonIndexableMetadata;

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/profile");
  }

  return (
    <ProfileForm
      user={{
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        emailVerified: Boolean(session.user.emailVerified),
        phone: session.user.phone ?? "",
      }}
    />
  );
}
