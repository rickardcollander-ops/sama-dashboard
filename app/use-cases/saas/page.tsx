import PersonaPage from "@/components/marketing/PersonaPage";
import { useCasesContent } from "@/lib/content/marketing/useCases";

export default function SaasPage() {
  return <PersonaPage {...useCasesContent.personas.saas} />;
}
