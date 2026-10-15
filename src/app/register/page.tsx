import { RegisterForm } from "~/components/auth/RegisterForm";
import { env } from "~/env";
import { nonIndexableMetadata } from "~/lib/indexing";

export const metadata = nonIndexableMetadata;

export default function RegisterPage() {
  const googleSignInEnabled = Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
  );

  return <RegisterForm googleSignInEnabled={googleSignInEnabled} />;
}
