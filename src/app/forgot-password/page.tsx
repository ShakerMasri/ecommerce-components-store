import { ForgotPasswordForm } from "~/components/auth/ForgotPasswordForm";
import { nonIndexableMetadata } from "~/lib/indexing";

export const metadata = nonIndexableMetadata;

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
