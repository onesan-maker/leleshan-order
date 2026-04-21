#!/usr/bin/env node

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = process.cwd();
const ignoredDirs = [".git", "node_modules", ".firebase", "coverage", "dist", "build"];
const ignoredFiles = new Set([".git-filter-repo-replacements.txt"]);
const textExtensions = new Set([
  ".js", ".cjs", ".mjs", ".json", ".md", ".html", ".css", ".txt", ".yml", ".yaml", ".env", ".sample", ".rules"
]);

const patterns = [
  {
    name: "Known leaked LINE token",
    regex: /QKVB4aucEsd0bkKsc8oNOPmmBI78T25tagNm76wT6WlmRZRI2Mw\+\+0T8uxzuL1NR4wUtR7E6O1SXxFJaiIHBjRWkRojzryQGa86r8\+hwFnpR42Dtfb3ZTIULxUG6Rxt91dwh6pXFLqNmudIVXLVCegdB04t89\/1O\/w1cDnyilFU=/g
  },
  {
    name: "LINE token assignment",
    regex: /(channel_access_token|LINE_CHANNEL_ACCESS_TOKEN|LINE_MESSAGING_CHANNEL_ACCESS_TOKEN)\s*[:=]\s*["'](?!<|YOUR_)[^"'\r\n]{20,}["']/gi
  },
  {
    name: "Bearer token literal",
    regex: /Bearer\s+[A-Za-z0-9+/_=-]{20,}/g
  },
  {
    name: "firebase functions config with inline token",
    regex: /firebase\s+functions:config:set\s+line\.channel_access_token\s*=\s*["'](?!<|YOUR_)[^"'\r\n]+["']/gi
  }
];

function getCandidateFiles() {
  try {
    const output = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], {
      cwd: repoRoot,
      encoding: "utf8"
    }).trim();
    if (output) {
      return output
        .split(/\r?\n/)
        .filter(Boolean)
        .filter((file) => !ignoredFiles.has(path.basename(file)))
        .map((file) => path.join(repoRoot, file));
    }
  } catch (error) {
    // Fall back to scanning the repo when git metadata is unavailable.
  }
  return walk(repoRoot);
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirs.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (shouldScan(fullPath)) files.push(fullPath);
  }
  return files;
}

function shouldScan(filePath) {
  if (ignoredFiles.has(path.basename(filePath))) return false;
  const ext = path.extname(filePath).toLowerCase();
  if (textExtensions.has(ext)) return true;
  const base = path.basename(filePath).toLowerCase();
  return base === ".env" || base.endsWith(".sample") || base.includes("config");
}

function main() {
  const failures = [];
  for (const filePath of getCandidateFiles()) {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) continue;
    const content = fs.readFileSync(filePath, "utf8");
    for (const pattern of patterns) {
      if (pattern.regex.test(content)) {
        failures.push(`${path.relative(repoRoot, filePath)}: ${pattern.name}`);
      }
      pattern.regex.lastIndex = 0;
    }
  }

  if (failures.length) {
    console.error("Secret scan failed. Remove sensitive values before committing:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Secret scan passed.");
}

main();
