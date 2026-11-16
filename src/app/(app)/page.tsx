import { requireUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-8">
      <h1 className="text-3xl font-semibold">Welcome{user.fullName ? `, ${user.fullName}` : ""}</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        You are logged in as <strong>{user.role}</strong>. Contacts, companies and deals are coming
        in the next steps.
      </p>
    </main>
  );
}
