import { SchemeDetailView } from "@/features/schemes/SchemeDetailView";

export default function SchemeDetailPage({ params }: { params: { slug: string } }) {
  return <SchemeDetailView slug={params.slug} />;
}
