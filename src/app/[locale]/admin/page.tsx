import { ConfigurationConsole } from "@/components/admin/configuration-console";
export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) { return <ConfigurationConsole locale={(await params).locale} />; }
