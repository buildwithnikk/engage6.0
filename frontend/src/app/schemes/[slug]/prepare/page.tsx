import { PreparationWizard } from "@/features/schemes/PreparationWizard";

export default function PrepareSchemePage({ params }: { params: { slug: string } }) {
  return <PreparationWizard slug={params.slug} />;
}
