#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function containsPath(root, candidate) {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

/**
 * Resolve a root to its real location. Containment is decided against `realpathSync`
 * link targets, so a root that still carries a symlinked ancestor — a checkout reached
 * through an alias, or the macOS `/var` -> `/private/var` temp directory — would make
 * every in-repository package link read as external.
 */
function canonicalRoot(path) {
  const resolved = resolve(path);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function walkTraceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkTraceFiles(path, out);
    else if (entry.isFile() && entry.name.endsWith(".nft.json")) out.push(path);
  }
  return out;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Classify one path segment, memoized: Next traces repeat the same directory prefixes
 * across every entry of every `.nft.json`, so an uncached walk costs one lstat per
 * segment per traced file on the deployment builder.
 */
function classifySegment(cache, path) {
  const cached = cache.get(path);
  if (cached !== undefined) return cached;
  // A path that cannot be stat'ed — including a symlink whose target is gone — counts
  // as missing, exactly as the followed-link existence check it replaces did.
  let entry = { missing: true, link: undefined };
  try {
    entry = lstatSync(path).isSymbolicLink()
      ? { missing: false, link: { path, target: realpathSync(path) } }
      : { missing: false, link: undefined };
  } catch {
    entry = { missing: true, link: undefined };
  }
  cache.set(path, entry);
  return entry;
}

function symlinksOnPath(root, target, cache) {
  const links = [];
  let cursor = root;
  for (const segment of relative(root, target).split(sep)) {
    if (segment === "") continue;
    cursor = join(cursor, segment);
    const entry = classifySegment(cache, cursor);
    if (entry.missing) break;
    if (entry.link !== undefined) links.push(entry.link);
  }
  return links;
}

export function validateVercelPackage(siteRootInput, tracingRootInput = repositoryRoot) {
  const siteRoot = canonicalRoot(siteRootInput);
  const tracingRoot = canonicalRoot(tracingRootInput);
  const nextRoot = join(siteRoot, ".next");
  const errors = [];

  if (!containsPath(tracingRoot, siteRoot)) {
    return [`site root '${siteRoot}' is outside tracing root '${tracingRoot}'`];
  }
  if (!existsSync(nextRoot)) {
    return [`${relative(tracingRoot, nextRoot)} is missing; run the site build first`];
  }

  const traceFiles = walkTraceFiles(nextRoot).sort();
  if (traceFiles.length === 0) {
    return [`${relative(tracingRoot, nextRoot)} contains no Next.js .nft.json traces`];
  }

  const tracedPaths = new Set();
  const segmentCache = new Map();
  const linksCache = new Map();
  for (const traceFile of traceFiles) {
    let trace;
    try {
      trace = readJson(traceFile);
    } catch (error) {
      errors.push(`${relative(tracingRoot, traceFile)} is invalid JSON: ${error.message}`);
      continue;
    }
    if (!Array.isArray(trace.files) || trace.files.some((file) => typeof file !== "string")) {
      errors.push(`${relative(tracingRoot, traceFile)} has no string-array 'files' contract`);
      continue;
    }

    for (const file of trace.files) {
      const tracedPath = resolve(dirname(traceFile), file);
      tracedPaths.add(tracedPath);
      if (!containsPath(tracingRoot, tracedPath)) {
        errors.push(
          `${relative(tracingRoot, traceFile)} traces '${file}' outside the monorepo root`,
        );
        continue;
      }
      if (classifySegment(segmentCache, tracedPath).missing) {
        errors.push(`${relative(tracingRoot, traceFile)} traces missing file '${file}'`);
        continue;
      }

      let links = linksCache.get(tracedPath);
      if (links === undefined) {
        links = symlinksOnPath(tracingRoot, tracedPath, segmentCache);
        linksCache.set(tracedPath, links);
      }
      for (const link of links) {
        if (!containsPath(tracingRoot, link.target)) {
          errors.push(
            `${relative(tracingRoot, traceFile)} reaches symlink '${relative(tracingRoot, link.path)}' outside the monorepo root`,
          );
        } else if (link.target.split(sep).includes("node_modules")) {
          errors.push(
            `${relative(tracingRoot, traceFile)} reaches pnpm package symlink '${relative(tracingRoot, link.path)}'; use the hoisted site linker before Vercel packages this function`,
          );
        }
      }
    }
  }

  const manifest = readJson(join(siteRoot, "package.json"));
  for (const [name, specifier] of Object.entries(manifest.dependencies ?? {})) {
    if (typeof specifier !== "string" || !specifier.startsWith("link:")) continue;
    const packageRoot = resolve(siteRoot, specifier.slice("link:".length));
    const packageManifest = join(packageRoot, "package.json");
    if (!containsPath(tracingRoot, packageRoot)) {
      errors.push(`${name} link target is outside the monorepo tracing root`);
    } else if (!tracedPaths.has(packageManifest)) {
      errors.push(
        `${name} package source is absent from the Next.js traces; outputFileTracingRoot must be the monorepo root`,
      );
    }
  }

  return [...new Set(errors)].sort();
}

function main() {
  const siteArg = process.argv[2];
  if (siteArg === undefined) {
    console.error("usage: node scripts/check-vercel-package.mjs <site-directory>");
    process.exit(2);
  }
  const siteRoot = resolve(process.cwd(), siteArg);
  const errors = validateVercelPackage(siteRoot);
  if (errors.length > 0) {
    console.error(`Vercel package check FAILED — ${errors.length} problem(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(
    `Vercel package check OK — ${relative(repositoryRoot, siteRoot)} traces stay inside the monorepo and contain no pnpm package symlink graph`,
  );
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
