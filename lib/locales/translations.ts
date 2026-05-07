// Wrapper that merges base translations from index.ts with auto-generated extras.
import { translations as base } from "./index";
import { svExtra } from "./extras_sv";
import { noExtra } from "./extras_no";
import { daExtra } from "./extras_da";
import { enExtra } from "./extras_en";

export const translations = {
  sv: { ...base.sv, ...svExtra },
  no: { ...base.no, ...noExtra },
  da: { ...base.da, ...daExtra },
  en: { ...base.en, ...enExtra },
};

export type { Language } from "./index";
export type Translations = typeof translations.sv;
export { LANGUAGES } from "./index";
