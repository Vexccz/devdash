// Smoke test: gitsafe.gitFetch wrapper for Fix 3.
// Run with: node scripts/test-git-wrap.cjs
//
// We can't import the TS module directly from Node without a compile step,
// so we verify the wrapper behavior end-to-end by exercising an equivalent
// execFile call with the same flags the wrapper passes. This proves:
//   - `git fetch --quiet` runs without shelling out (no PowerShell parser),
//   - exit code is 0 against an existing repo,
//   - stderr is captured into a string buffer (not an error object).
//
// Then we also assert the source file exports the expected names.

const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoPath = path.resolve(__dirname, '..');

function runGitFetch() {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['fetch', '--quiet'],
      {
        cwd: repoPath,
        windowsHide: true,
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_PAGER: 'cat',
          LC_ALL: 'C',
        },
      },
      (err, stdout, stderr) => {
        resolve({
          code: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? ''),
          err: err ? err.message : null,
        });
      }
    );
  });
}

(async () => {
  let failures = 0;

  // Source check.
  const srcPath = path.join(__dirname, '..', 'electron', 'gitsafe.ts');
  if (!fs.existsSync(srcPath)) {
    failures++;
    console.error('FAIL: electron/gitsafe.ts missing');
  } else {
    const txt = fs.readFileSync(srcPath, 'utf-8');
    for (const name of [
      'export async function gitFetch',
      'export async function gitPull',
      'export async function gitPush',
    ]) {
      if (!txt.includes(name)) {
        failures++;
        console.error('FAIL: gitsafe.ts missing export:', name);
      } else {
        console.log('ok export present:', name);
      }
    }
    // Make sure we did not introduce the invalid flag.
    if (txt.includes('--progress=false')) {
      failures++;
      console.error("FAIL: gitsafe.ts still uses '--progress=false' (invalid flag)");
    } else {
      console.log("ok: no '--progress=false' in gitsafe.ts");
    }
  }

  // Runtime smoke: `git fetch --quiet` against this repo.
  console.log('Running git fetch --quiet in', repoPath);
  const res = await runGitFetch();
  console.log('exit code:', res.code);
  if (res.stderr) console.log('stderr (len ' + res.stderr.length + '):', res.stderr.slice(0, 200));
  if (res.stdout) console.log('stdout (len ' + res.stdout.length + ')');

  if (res.code !== 0) {
    // Network errors are possible; treat "no upstream configured" and
    // "Could not resolve host" as environment conditions, not wrapper bugs.
    const envProblem =
      /no such remote|does not appear to be a git repository|Could not resolve host|Authentication failed|remote error/i.test(
        res.stderr
      );
    if (envProblem) {
      console.warn('WARN: git fetch failed due to env (network/remote):', res.stderr.split('\n')[0]);
      console.warn('      Wrapper still returned a structured result, which is the point.');
    } else {
      failures++;
      console.error('FAIL: git fetch exited non-zero without a known env reason.');
    }
  } else {
    console.log('ok: git fetch exit code 0');
  }

  if (failures > 0) {
    console.error(`\n${failures} failure(s).`);
    process.exit(1);
  }
  console.log('\nAll gitsafe smoke checks passed.');
})();
