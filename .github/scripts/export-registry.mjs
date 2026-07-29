import { access, mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const excludedPackages = new Set([
  "patterns",
  "shadcn-ui",
  "typescript-config",
]);
const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const packagesDirectory = join(repositoryRoot, "packages");
const outputDirectory = join(repositoryRoot, "apps/registry/dist");

const packageEntries = await readdir(packagesDirectory, {
  withFileTypes: true,
});
const packageNames = [];

for (const entry of packageEntries.sort((left, right) =>
  left.name.localeCompare(right.name)
)) {
  if (!entry.isDirectory() || excludedPackages.has(entry.name)) {
    continue;
  }

  try {
    await access(join(packagesDirectory, entry.name, "package.json"));
    packageNames.push(entry.name);
  } catch {
    // Only package directories with a package.json are registry items.
  }
}

if (packageNames.length === 0) {
  throw new Error("No registry packages were found.");
}

// getPackage resolves packages relative to the docs app's working directory.
process.chdir(join(repositoryRoot, "apps/docs"));
const { getPackage } = await import("../../apps/docs/lib/package.ts");
const payloads = await Promise.all(
  packageNames.map(async (packageName) => ({
    packageName,
    payload: await getPackage(packageName),
  }))
);

await mkdir(outputDirectory, { recursive: true });
const existingFiles = await readdir(outputDirectory, { withFileTypes: true });

await Promise.all(
  existingFiles
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => unlink(join(outputDirectory, entry.name)))
);

await Promise.all(
  payloads.map(({ packageName, payload }) =>
    writeFile(
      join(outputDirectory, `${packageName}.json`),
      JSON.stringify(payload)
    )
  )
);

console.log(
  `Exported ${payloads.length} registry payloads to ${outputDirectory}`
);
