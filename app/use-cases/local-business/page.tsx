import PersonaPage from "@/components/marketing/PersonaPage";
import { useCasesContent } from "@/lib/content/marketing/useCases";

export default function LocalBusinessPage() {
  return <PersonaPage {...useCasesContent.personas.localBusiness} />;
}
