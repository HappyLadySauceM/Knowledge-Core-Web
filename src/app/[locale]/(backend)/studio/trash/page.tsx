import { TrashClient } from "@/components/studio/trash-client";
export default async function TrashPage({ params }: { params: Promise<{ locale: string }> }) { return <TrashClient locale={(await params).locale} />; }
