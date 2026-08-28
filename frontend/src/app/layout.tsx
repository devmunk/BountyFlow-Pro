import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ActivityProvider } from "@/components/ActivityProvider";

export const metadata: Metadata = {
  title: "BountyFlow Pro",
  description: "A production-oriented decentralized bounty marketplace on Stellar Soroban.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bf-black text-bf-green-muted antialiased">
        <Navbar />
        <ActivityProvider>
          <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">{children}</main>
        </ActivityProvider>
      </body>
    </html>
  );
}
