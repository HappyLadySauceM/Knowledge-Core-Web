import { AuthForm } from "@/components/auth-form";

export default async function Register({ params }: { params: Promise<{ locale: string }> }) { return <AuthForm locale={(await params).locale} mode="register" />; }
