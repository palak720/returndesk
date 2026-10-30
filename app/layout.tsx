import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ReturnDesk", template: "%s · ReturnDesk" },
  description: "A returns desk for a small online store.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-rule bg-surface">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              ReturnDesk
            </Link>
            <Link
              href="/requests/new"
              className="rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              New request
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
