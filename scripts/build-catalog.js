const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { execFileSync } = require('child_process');

// First-party defaults are synced into the app build, not the community store,
// so they are excluded from the public catalog. (Mirrors RESERVED_DIRS in
// scripts/validate.mjs, which skips them during validation.)
const RESERVED_DIRS = new Set(['default']);

// Legacy sentinel, still accepted so older configs keep working. New configs use
// `{{authors}}` / `{{published_at}}` variables — keep these names in sync with
// METADATA_VARIABLES in scripts/schema.mjs.
const LEGACY_SENTINEL = '__AUTO_GENERATED__';

function getFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (RESERVED_DIRS.has(file)) continue;
      getFiles(filePath, fileList);
    } else if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

// Run git without a shell so a crafted filename can't inject commands.
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function gitAuthors(filePath) {
  let authors = [];
  try {
    const out = git(['log', '--format=%an', '--', filePath]);
    if (out) authors = [...new Set(out.split('\n').filter(Boolean))];
  } catch (e) {
    /* fall through to fallbacks */
  }
  if (authors.length === 0) {
    try {
      const me = git(['config', 'user.name']) || git(['config', 'user.email']);
      if (me) authors.push(me);
    } catch (e) {
      /* ignore */
    }
  }
  if (authors.length === 0) authors.push('Unknown Author');
  return authors;
}

function gitPublishedAt(filePath) {
  try {
    // Oldest matching commit (the addition) is the last line of `git log`.
    const dates = git(['log', '--diff-filter=A', '--format=%aI', '--', filePath])
      .split('\n')
      .filter(Boolean);
    if (dates.length) return dates[dates.length - 1];
  } catch (e) {
    /* fall through */
  }
  return new Date().toISOString();
}

// True if `value` is a placeholder that should be filled from git for `field`:
// the `{{field}}` variable, or the legacy `__AUTO_GENERATED__` sentinel.
function isAutoValue(value, field) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v === LEGACY_SENTINEL) return true;
  const m = v.match(/^\{\{\s*([a-zA-Z_]\w*)\s*\}\}$/);
  return m != null && m[1] === field;
}

function resolveMetadata(metadata, filePath) {
  if (metadata.published_at == null || isAutoValue(metadata.published_at, 'published_at')) {
    metadata.published_at = gitPublishedAt(filePath);
  }

  const declared = Array.isArray(metadata.authors) ? metadata.authors : [];
  if (declared.length === 0 || declared.some((a) => isAutoValue(a, 'authors'))) {
    // Keep any explicitly-listed authors, then append the git-derived ones.
    const explicit = declared.filter((a) => !isAutoValue(a, 'authors'));
    metadata.authors = [...new Set([...explicit, ...gitAuthors(filePath)])];
  }
}

function build() {
  const agentsDir = path.join(__dirname, '..', 'agents');
  const files = getFiles(agentsDir);
  const catalog = [];

  for (const file of files) {
    const relativePath = path.relative(agentsDir, file);
    const category = relativePath.split(path.sep)[0];
    const parsed = yaml.parse(fs.readFileSync(file, 'utf8'));

    resolveMetadata(parsed.metadata, file);

    catalog.push({ category, ...parsed });
  }

  const outputPath = path.join(__dirname, '..', 'catalog.json');
  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2));
  console.log(`✅ Built catalog.json with ${catalog.length} agents.`);
}

build();
