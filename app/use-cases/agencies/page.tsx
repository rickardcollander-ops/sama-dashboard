import PersonaPage from "@/components/marketing/PersonaPage";
import { useCasesContent } from "@/lib/content/marketing/useCases";

export default function AgenciesPage() {
  return <PersonaPage {...useCasesContent.personas.agencies} />;
}
