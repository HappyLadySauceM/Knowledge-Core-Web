import { AuthForm } from "@/components/auth-form";

export default async function Login({ params }: { params: Promise<{ locale: string }> }) { return <AuthForm locale={(await params).locale} mode="login" />; }
