import PersonaPage from "@/components/marketing/PersonaPage";
import { useCasesContent } from "@/lib/content/marketing/useCases";

export default function ConsultingPage() {
  return <PersonaPage {...useCasesContent.personas.consulting} />;
}
