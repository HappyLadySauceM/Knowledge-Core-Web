import { MediaLibrary } from "@/components/studio/media-library";
export default async function MediaPage({ params }: { params: Promise<{ locale: string }> }) { return <MediaLibrary locale={(await params).locale} />; }
