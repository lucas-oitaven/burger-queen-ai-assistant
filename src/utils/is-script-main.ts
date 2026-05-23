import { basename } from "node:path";

/**
 * True quando o arquivo foi executado diretamente (ex.: `tsx src/scripts/foo.ts`).
 * Usa o nome do arquivo — compatível com `module: CommonJS` no tsconfig.
 */
export function isScriptMain(scriptFileName: string): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return basename(entry) === scriptFileName;
}
