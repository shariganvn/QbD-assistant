#!/usr/bin/env node

import { main } from "./publication.mjs";

export { createReasoningCli, main } from "./publication.mjs";

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  try {
    const destination = main(process.argv.slice(2));
    process.stdout.write(`Published reasoning artifacts: ${destination}\n`);
  } catch (error) {
    const code = error?.code ?? "E_PUBLICATION_WRITE";
    process.stderr.write(`${code}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
