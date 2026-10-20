#!/usr/bin/env node
/**
 * Deploy landing/dist to Vercel over the REST API.
 *
 * Why a script instead of `vercel --prod`? The CLI lives in ~/.vercel and needs
 * an interactive login; this only needs a token in the environment, so it works
 * from CI, from Render, or from a phone SSH session.
 *
 *   VERCEL_TOKEN=xxx npm run deploy:vercel
 *
 * Options (all optional, sane defaults):
 *   --project <name|id>   project to deploy into        (default: dark-eyes)
 *   --team <id|slug>      team/owner scope              (default: token's default)
 *   --dir <path>          directory to upload           (default: landing/dist)
 *   --root <path>         Vercel root directory         (default: landing)
 *   --target <env>        production | preview | staging (default: production)
 *   --dry-run             print what would be uploaded
 *
 * How it works: every file is POSTed to /v2/files first, which returns a
 * content sha. The deployment then references those shas, so binary files
 * (PNG banners, fonts) survive intact — the JSON `data` field would mangle them.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const API = 'https://api.vercel.com';
const TOKEN = process.env.VERCEL_TOKEN;

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const PROJECT = arg('project', 'dark-eyes');
const TEAM = arg('team', process.env.VERCEL_TEAM_ID || '');
const DIR = resolve(arg('dir', 'landing/dist'));
const ROOT = arg('root', 'landing');
const TARGET = arg('target', 'production');
const DRY = flag('dry-run');

if (!TOKEN) {
  console.error('Missing VERCEL_TOKEN. Create one at https://vercel.com/account/tokens');
  process.exit(1);
}

const qs = (extra = {}) => {
  const p = new URLSearchParams(extra);
  if (TEAM) p.set('teamId', TEAM);
  const s = p.toString();
  return s ? `?${s}` : '';
};

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${init.method || 'GET'} ${path} → ${res.status} ${body.error?.message || text}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, base)));
    else if (entry.isFile()) out.push({ full, rel: relative(base, full).split(sep).join('/') });
  }
  return out;
}

async function upload(file) {
  const bytes = await readFile(file.full);
  const sha = createHash('sha1').update(bytes).digest('hex');

  // Vercel treats an existing sha as success (409/400 "already exists").
  try {
    const res = await fetch(`${API}/v2/files${qs()}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/octet-stream',
        'x-vercel-digest': sha,
        'content-length': String(bytes.length),
      },
      body: bytes,
    });
    if (!res.ok) {
      const text = await res.text();
      if (!/already exists|file already|409/i.test(`${res.status} ${text}`)) {
        throw new Error(`upload ${file.rel} → ${res.status} ${text}`);
      }
    }
  } catch (err) {
    if (!/already exists/i.test(err.message)) throw err;
  }

  return { file: file.rel, sha, size: bytes.length };
}

async function main() {
  const files = await walk(DIR);
  if (!files.length) throw new Error(`nothing to upload in ${DIR} — run "npm run build" in landing/ first`);

  console.log(`📦 ${files.length} files from ${DIR}`);
  for (const f of files) console.log(`   · ${f.rel}`);

  if (DRY) {
    console.log('dry run — no request sent');
    return;
  }

  const uploaded = [];
  for (const f of files) {
    uploaded.push(await upload(f));
    process.stdout.write('.');
  }
  console.log('\n✅ uploaded');

  const deployment = await api(`/v13/deployments${qs({ forceNew: '1' })}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: PROJECT,
      project: PROJECT,
      target: TARGET,
      // Files land under landing/dist so the project's own settings
      // (root: landing, output: dist) stay meaningful for future git builds.
      files: uploaded.map(({ file, sha, size }) => ({ file: `${ROOT}/dist/${file}`, sha, size })),
      projectSettings: {
        buildCommand: 'true',
        installCommand: 'true',
        outputDirectory: 'dist',
        rootDirectory: ROOT,
        framework: null,
      },
    }),
  });

  console.log(`🚀 ${deployment.url}  (${deployment.id})`);

  // Poll until the platform finishes (usually 5–20s for static output).
  for (let i = 0; i < 60; i += 1) {
    const d = await api(`/v13/deployments/${deployment.id}${qs()}`);
    const state = d.readyState || d.status;
    if (state === 'READY') {
      console.log(`✅ READY — https://${deployment.url}`);
      return;
    }
    if (state === 'ERROR' || state === 'CANCELED') {
      throw new Error(`deployment ${state}: ${d.errorMessage || 'unknown error'} ${d.errorLink || ''}`);
    }
    process.stdout.write(`\r⏳ ${state}…`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('timed out waiting for the deployment to become READY');
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
