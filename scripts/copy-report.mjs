import { cp, mkdir } from "node:fs/promises";
await mkdir("dist/comparisons", { recursive: true });
await cp("docs/comparisons", "dist/comparisons", { recursive: true });
await cp("docs/licenses", "dist/licenses", { recursive: true });
await cp("LICENSE", "dist/LICENSE");
