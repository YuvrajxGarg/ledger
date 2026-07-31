// Public surface of the invoice brain. Import from "@/lib/ai".
export { aiEnabled, aiModel, AiDisabledError, chat } from "./client";
export {
  extractInvoiceFields,
  matchProject,
  detectDuplicate,
  parseSubjectConvention,
  slugify,
  type ExtractedInvoice,
  type MatchResult,
} from "./invoice";
