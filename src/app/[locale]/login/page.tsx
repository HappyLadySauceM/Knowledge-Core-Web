import { AuthForm } from "@/components/auth-form";

export default async function Login({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; registered?: string }>;
}) {
  const [{ locale }, { next, registered }] = await Promise.all([params, searchParams]);
  return <AuthForm locale={locale} mode="login" next={next} registered={registered === "1"} />;
}
