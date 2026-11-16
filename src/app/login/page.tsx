import { LoginForm } from "./login-form";

export const metadata = { title: "Log in · CRM" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Log in to CRM</h1>
      {error === "inactive" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          This account is no longer active. Contact an admin.
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className="text-sm text-neutral-500">
        Accounts are created by an admin. Forgot your password? Ask an admin to reset it.
      </p>
    </main>
  );
}
