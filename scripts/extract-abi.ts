import fs from 'fs';
import path from 'path';

async function main() {
  await extractAbi('artifacts/contracts', 'artifacts/abi');
}

async function extractAbi(from: string, to: string): Promise<void> {
  if (!(await fileExists(to))) {
    await fs.promises.mkdir(to);
  }

  const items = await fs.promises.readdir(from);
  for (const item of items) {
    const stats = await fs.promises.lstat(path.join(from, item));
    if (stats.isDirectory()) {
      await extractAbi(path.join(from, item), path.join(to, item));
    } else {
      const data = JSON.parse((await fs.promises.readFile(path.join(from, item))).toString());
      if (data.abi == undefined) {
        continue;
      }

      const newData = JSON.stringify(data.abi);
      await fs.promises.writeFile(path.join(to, item), newData);
    }
  }
}

async function fileExists(file: string): Promise<boolean> {
  return fs.promises
    .access(file, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
