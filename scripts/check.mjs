import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const files = [];
for (const folder of ["assets", "server", "scripts", "test"])
  for (const name of await readdir(folder))
    if (/\.(js|mjs)$/.test(name)) files.push(`${folder}/${name}`);
for (const file of files) {
  const r = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exitCode = 1;
  }
}
for (const file of [
  "index.html",
  "auth/login.html",
  "auth/register.html",
  "account/index.html",
  "legal/privacy.html",
  "legal/terms.html",
  "legal/cookies.html",
]) {
  const s = await readFile(file, "utf8");
  if (!s.includes("https://bineisa.com/")) {
    console.error(`Missing ecosystem link: ${file}`);
    process.exitCode = 1;
  }
  if (/on(?:click|submit)\s*=/.test(s)) {
    console.error(`Inline event handler: ${file}`);
    process.exitCode = 1;
  }
}
if (!process.exitCode)
  console.log(
    `Syntax checks passed for ${files.length} JavaScript modules; ecosystem links checked.`,
  );
