import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { logout } from "@/app/login/actions";

/** Every page inside the (app) folder requires login and shows the top bar. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="font-semibold">
            CRM
          </Link>
          <Link href="/tasks" className="hover:underline">
            Tasks
          </Link>
          <Link href="/contacts" className="hover:underline">
            Contacts
          </Link>
          <Link href="/companies" className="hover:underline">
            Companies
          </Link>
          <Link href="/deals" className="hover:underline">
            Deals
          </Link>
          <Link href="/activity" className="hover:underline">
            Activity
          </Link>
          {user.role === "admin" && (
            <Link href="/settings/pipelines" className="hover:underline">
              Settings
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <span>
            {user.fullName ?? user.email}{" "}
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {user.role}
            </span>
          </span>
          <form action={logout}>
            <button type="submit" className="underline underline-offset-4">
              Log out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
