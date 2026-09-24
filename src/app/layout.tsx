import "~/styles/globals.css";

import { type Metadata } from "next";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { WhatsappSupportShortcut } from "~/components/layout/WhatsappSupportShortcut";
import { storeConfig } from "~/config/store";
import { AppPreferencesProvider } from "~/components/providers/AppPreferencesProvider";

export const metadata: Metadata = {
  title: storeConfig.metadata.title,
  description: storeConfig.metadata.description,
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-50 font-sans text-zinc-950 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        <AppPreferencesProvider>
          <Header />
          <main>{children}</main>
          <Footer />
          <WhatsappSupportShortcut />
        </AppPreferencesProvider>
      </body>
    </html>
  );
}
