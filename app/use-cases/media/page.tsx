import PersonaPage from "@/components/marketing/PersonaPage";
import { useCasesContent } from "@/lib/content/marketing/useCases";

export default function MediaPage() {
  return <PersonaPage {...useCasesContent.personas.media} />;
}
