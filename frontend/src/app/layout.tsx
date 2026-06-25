import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { QueryProvider } from "@/lib/query-client";
import { UserProvider } from "@/lib/user-context";

export const metadata: Metadata = {
  title: "Knowledge Verification Platform",
  description: "AI-powered business knowledge verification",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <UserProvider>
            <div className="flex h-screen">
              <Sidebar />
              <div className="flex flex-1 flex-col overflow-hidden">
                <header className="flex h-16 items-center justify-between border-b bg-background px-8">
                  <div className="text-sm text-muted-foreground">
                    Internal Knowledge Verification — MVP
                  </div>
                  <RoleSwitcher />
                </header>
                <main className="flex-1 overflow-auto bg-secondary/30 p-8">
                  {children}
                </main>
              </div>
            </div>
          </UserProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
