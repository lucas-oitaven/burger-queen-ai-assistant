import { parseJsonSafe } from "../../utils/safe-json.js";
import {
  type IntentClassification,
  parseIntentClassification,
} from "./intent.types.js";

/**
 * Converte texto bruto do modelo (JSON ou markdown) em classificação validada.
 * JSON inválido ou fora do schema → `null`.
 */
export function parseIntentClassificationFromText(
  raw: string,
): IntentClassification | null {
  const json = parseJsonSafe(raw);
  if (json === null) {
    return null;
  }

  return parseIntentClassification(json);
}
