import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";

/** Settings are admin-only; members get "not found". */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== "admin") notFound();

  return (
    <div>
      <nav aria-label="Settings" className="mx-auto flex max-w-4xl gap-4 px-8 pt-6 text-sm">
        <Link href="/settings/pipelines" className="hover:underline">
          Pipelines
        </Link>
        <Link href="/settings/export" className="hover:underline">
          Export
        </Link>
      </nav>
      {children}
    </div>
  );
}
