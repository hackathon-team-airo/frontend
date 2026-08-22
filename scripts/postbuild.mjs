import { existsSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const isCloudflare = Boolean(
  process.env.CLOUDFLARE_BUILD || process.env.WORKERS_CI || process.env.CF_PAGES,
);

if (isCloudflare) {
  if (!process.env.OPEN_NEXT_BUILD) {
    const result = spawnSync(
      'npx',
      ['opennextjs-cloudflare', 'build', '--skipNextBuild'],
      { cwd: root, stdio: 'inherit', env: { ...process.env, OPEN_NEXT_BUILD: '1' } },
    );
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
    console.log('postbuild: built Cloudflare worker into .open-next');
  }
  process.exit(0);
}

const standalone = join(root, '.next', 'standalone');

if (!existsSync(standalone)) {
  console.error('postbuild: .next/standalone missing — is output: "standalone" set?');
  process.exit(1);
}

const assets = [
  { from: join(root, 'public'), to: join(standalone, 'public') },
  { from: join(root, '.next', 'static'), to: join(standalone, '.next', 'static') },
];

for (const { from, to } of assets) {
  if (existsSync(from)) {
    await cp(from, to, { recursive: true });
  }
}

console.log('postbuild: copied public/ and .next/static into .next/standalone');
