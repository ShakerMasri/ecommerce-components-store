import { nonIndexableMetadata } from "~/lib/indexing";

export const metadata = nonIndexableMetadata;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
