import { createEngine } from "@secretlint/node";
import { creator } from "@secretlint/secretlint-rule-preset-recommend";
import { error } from "./finding.mjs";

// secretlint's bundled filter-comments rule lets a `secretlint-disable` comment
// suppress findings. Since we scan contributor-controlled content, that would be
// a trivial bypass — so we neutralize those directives before scanning. The
// replacement is length-preserving so reported line/column numbers stay accurate.
const neutralizeDirectives = (text) =>
  text.replace(/secretlint-(?:disable(?:-next-line|-line)?|enable)/gi, (m) => "x".repeat(m.length));

/**
 * Build a reusable secret scanner. The engine is created once (async) and the
 * returned function scans a piece of content synchronously per call.
 * @returns {Promise<(content: string, filePath: string) => Promise<object[]>>}
 */
export async function createSecretScanner() {
  const engine = await createEngine({
    formatter: "json",
    color: false,
    maskSecrets: true, // never echo a detected secret back into CI logs
    configFileJSON: {
      rules: [{ id: "@secretlint/secretlint-rule-preset-recommend", rule: creator }],
    },
  });

  return async function scanSecrets(content, filePath) {
    const { output } = await engine.executeOnContent({
      content: neutralizeDirectives(content),
      filePath,
    });

    const findings = [];
    for (const file of JSON.parse(output)) {
      for (const message of file.messages) {
        findings.push(error("secrets", message.message, message.loc?.start?.line));
      }
    }
    return findings;
  };
}
