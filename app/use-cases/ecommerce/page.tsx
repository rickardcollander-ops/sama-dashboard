import PersonaPage from "@/components/marketing/PersonaPage";
import { useCasesContent } from "@/lib/content/marketing/useCases";

export default function EcommercePage() {
  return <PersonaPage {...useCasesContent.personas.ecommerce} />;
}
