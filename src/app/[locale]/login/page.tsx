import { AuthForm } from "@/components/auth-form";

export default async function Login({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) { const [{ locale }, { next }] = await Promise.all([params, searchParams]); return <AuthForm locale={locale} mode="login" next={next} />; }
