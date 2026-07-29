import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageName = "video-player";
const packageDir = join(rootDir, "packages", packageName);
const outputDir = join(rootDir, "apps", "registry", "dist");
const outputPath = join(outputDir, `${packageName}.json`);

const packageJson = JSON.parse(
  await readFile(join(packageDir, "package.json"), "utf8")
);
const packageFiles = await readdir(packageDir, { withFileTypes: true });
const tsxFiles = packageFiles
  .filter((file) => file.isFile() && file.name.endsWith(".tsx"))
  .sort((left, right) => left.name.localeCompare(right.name));

const files = await Promise.all(
  tsxFiles.map(async (file) => ({
    type: "registry:ui",
    path: file.name,
    content: await readFile(join(packageDir, file.name), "utf8"),
    target: `components/kibo-ui/${packageName}/${file.name}`,
  }))
);

const workspaceDependencies = Object.keys(packageJson.dependencies ?? {}).filter(
  (dependency) =>
    dependency.startsWith("@repo/") && dependency !== "@repo/shadcn-ui"
);
const dependencies = Object.keys(packageJson.dependencies ?? {}).filter(
  (dependency) =>
    ![
      "react",
      "react-dom",
      "@repo/shadcn-ui",
      ...workspaceDependencies,
    ].includes(dependency)
);
const devDependencies = Object.keys(packageJson.devDependencies ?? {}).filter(
  (dependency) =>
    ![
      "@repo/typescript-config",
      "@types/react",
      "@types/react-dom",
      "typescript",
    ].includes(dependency)
);
const registryDependencies = [
  ...new Set(
    files
      .flatMap((file) =>
        [...file.content.matchAll(/@\/components\/ui\/([a-z-]+)/g)].map(
          (match) => match[1]
        )
      )
      .filter(Boolean)
  ),
  ...workspaceDependencies.map(
    (dependency) =>
      `https://www.kibo-ui.com/r/${dependency.replace("@repo/", "")}.json`
  ),
];

const registryItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: packageName,
  type: "registry:ui",
  title: packageName,
  description: packageJson.description,
  author: "Hayden Bleasel <hello@haydenbleasel.com>",
  dependencies,
  devDependencies,
  registryDependencies,
  files,
  css: {},
};

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(registryItem, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
