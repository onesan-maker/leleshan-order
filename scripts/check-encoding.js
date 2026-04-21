#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = process.cwd();
const TARGET_EXTENSIONS = new Set([".html", ".js", ".css", ".json", ".md"]);
const IGNORED_DIRS = new Set([".git", "node_modules", "dist", "build"]);
const INVALID_TEXT_PATTERNS = [
  String.fromCharCode(63, 63, 63),
  String.fromCharCode(0xfffd)
];
const htmlCharsetPattern = /<meta\s+[^>]*charset\s*=\s*["']?\s*utf-8\s*["']?[^>]*>/i;

const issues = [];

walk(ROOT_DIR);

if (issues.length > 0) {
  console.error("Encoding checks failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Encoding checks passed.");

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walk(fullPath);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!TARGET_EXTENSIONS.has(ext)) continue;

    checkFile(fullPath, ext);
  }
}

function checkFile(filePath, ext) {
  const content = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(ROOT_DIR, filePath).replace(/\\/g, "/");

  for (const pattern of INVALID_TEXT_PATTERNS) {
    if (content.includes(pattern)) {
      issues.push(`${relativePath}: contains "${pattern}"`);
    }
  }

  if (ext === ".html" && !htmlCharsetPattern.test(content)) {
    issues.push(`${relativePath}: missing <meta charset="UTF-8">`);
  }
}
