import { SecuritySettings } from "@/components/security-settings";

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) { return <SecuritySettings locale={(await params).locale} />; }
