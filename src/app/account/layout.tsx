import { nonIndexableMetadata } from "~/lib/indexing";

export const metadata = nonIndexableMetadata;

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
