"use client";

import {
  BarChart3,
  Brain,
  FileText,
  GraduationCap,
  ListChecks,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/user-context";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  roles?: Array<"admin" | "manager" | "employee">;
};

const ITEMS: Item[] = [
  { href: "/", label: "Dashboard", Icon: BarChart3 },
  { href: "/documents", label: "Documents", Icon: FileText, roles: ["admin"] },
  { href: "/knowledge", label: "Knowledge Review", Icon: Brain, roles: ["admin"] },
  { href: "/assessments", label: "Assessments", Icon: ListChecks, roles: ["manager", "admin"] },
  { href: "/study", label: "Study Center", Icon: BookOpen },
  { href: "/exam", label: "My Exams", Icon: GraduationCap, roles: ["employee"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { currentUser } = useUser();
  const role = currentUser?.role;

  return (
    <aside className="w-60 shrink-0 border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Brain className="h-4 w-4" />
          </div>
          <span className="font-semibold">Knowledge Verify</span>
        </Link>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {ITEMS.map((item) => {
          if (item.roles && role && !item.roles.includes(role)) return null;
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground/70 hover:bg-accent hover:text-foreground"
              )}
            >
              <item.Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
