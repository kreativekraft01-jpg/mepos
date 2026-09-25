import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const dir = await mkdtemp(join(tmpdir(), 'pos-tests-'))
try {
  await build({ entryPoints: ['tests/assistant.test.ts'], bundle: true, platform: 'node', format: 'esm', plugins: [{ name: 'mock-local-model', setup(build) { build.onResolve({ filter: /^@mlc-ai\/web-llm$/ }, () => ({ path: join(process.cwd(), 'tests/mock-webllm.ts') })) } }], outfile: join(dir, 'tests.mjs') })
  const result = spawnSync(process.execPath, ['--test', join(dir, 'tests.mjs')], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
  // Keep the existing catalog and policy regression suites in the same command.
  for (const name of ['test-search', 'test-edge-cases', 'test-filters', 'test-kb']) {
    const outfile = join(dir, `${name}.mjs`)
    await build({ entryPoints: [`src/utils/${name}.ts`], bundle: true, platform: 'node', format: 'esm', outfile })
    const legacy = spawnSync(process.execPath, [outfile], { encoding: 'utf8' })
    const summary = legacy.stdout.match(/=== \d+ passed, \d+ failed[^\n]*/)?.[0]
    console.log(`${name}: ${summary ?? 'No test summary'}`)
    if (legacy.status !== 0 || !summary || !/ 0 failed/.test(summary)) {
      console.error(legacy.stdout, legacy.stderr)
      process.exitCode = 1
    }
  }
} finally { await rm(dir, { recursive: true, force: true }) }
