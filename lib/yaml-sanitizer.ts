/**
 * YAML Front Matter Sanitizer
 *
 * Fixes common YAML front matter issues in blog post markdown files:
 * - Multi-line strings not escaped with block scalar notation
 * - Strings containing special YAML characters (colons, quotes, etc.)
 */

const YAML_SPECIAL_CHARS = /[:#{}\[\],&*?|<>=!%@`]|^['"~]|^\s|\s$/;
const YAML_RESERVED = /^(true|false|null|yes|no|on|off)$/i;
const YAML_NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$|^0x[0-9a-fA-F]+$|^0o[0-7]+$/;

/**
 * Wrap a scalar YAML value in double quotes, escaping internal quotes and backslashes.
 */
function quoteYamlString(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Determine if a plain scalar value needs to be quoted or put in a block scalar.
 * Returns:
 *   - The original value if it's already safe
 *   - A quoted version if it contains special characters
 *   - A block scalar version if it's multi-line
 */
function sanitizeScalar(value: string, indent: string): string {
  if (value === '') return '""';

  // Already block scalar – leave as-is (caller handles this)
  if (value === '|' || value === '>' || value === '|-' || value === '>-') return value;

  // Multi-line values must use block scalar notation
  if (value.includes('\n')) {
    const lines = value.split('\n');
    const blockLines = lines.map((l) => `${indent}  ${l}`).join('\n');
    return `|\n${blockLines}`;
  }

  // Reserved words, numbers, and values with special chars must be quoted
  if (
    YAML_SPECIAL_CHARS.test(value) ||
    YAML_RESERVED.test(value.trim()) ||
    YAML_NUMBER.test(value.trim())
  ) {
    return quoteYamlString(value);
  }

  return value;
}

/**
 * Sanitize YAML front matter in a markdown string.
 *
 * Handles:
 * 1. Values containing YAML-special characters → double-quoted
 * 2. Continuation lines (multi-line values not in block scalar) → `|` block scalar
 * 3. Already-valid values → left untouched
 */
export function sanitizeFrontMatter(markdown: string): string {
  // Front matter must start at position 0
  if (!markdown.startsWith('---')) return markdown;

  const endMatch = markdown.match(/^---\r?\n([\s\S]*?)\n---(\r?\n|$)/);
  if (!endMatch) return markdown;

  const frontMatterBlock = endMatch[1];
  const rest = markdown.slice(endMatch[0].length);
  const lines = frontMatterBlock.split('\n');

  const fixedLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === '') {
      fixedLines.push(line);
      i++;
      continue;
    }

    // Detect key: value pattern (not a continuation, not a list item)
    const kvMatch = line.match(/^(\s*)([\w_-]+):\s*(.*)/);
    if (!kvMatch) {
      // Not a key:value line – keep as-is (handles list items, comments, etc.)
      fixedLines.push(line);
      i++;
      continue;
    }

    const [, indent, key, rawValue] = kvMatch;

    // Already a block scalar indicator – keep the line and following indented lines
    if (rawValue === '|' || rawValue === '>' || rawValue === '|-' || rawValue === '>-') {
      fixedLines.push(line);
      i++;
      // Consume indented continuation lines
      while (i < lines.length && (lines[i].startsWith(indent + '  ') || lines[i].trim() === '')) {
        fixedLines.push(lines[i]);
        i++;
      }
      continue;
    }

    // Already a quoted value – keep as-is
    if (rawValue.startsWith('"') || rawValue.startsWith("'")) {
      fixedLines.push(line);
      i++;
      continue;
    }

    // Collect improperly wrapped continuation lines:
    // A continuation line is one that doesn't start with a YAML key at the same indent level.
    let fullValue = rawValue;
    let j = i + 1;
    while (j < lines.length) {
      const nextLine = lines[j];
      if (nextLine.trim() === '') break; // blank line ends continuation
      // If the next line starts with a key at same or lower indent, stop
      const nextKv = nextLine.match(/^(\s*)([\w_-]+):/);
      if (nextKv && nextKv[1].length <= indent.length) break;
      // It's a continuation
      fullValue += '\n' + nextLine.trim();
      j++;
    }

    const sanitized = sanitizeScalar(fullValue, indent);

    if (sanitized.startsWith('|') || sanitized.startsWith('>')) {
      // Block scalar – the indicator replaces the value on the key line
      fixedLines.push(`${indent}${key}: ${sanitized}`);
    } else {
      fixedLines.push(`${indent}${key}: ${sanitized}`);
    }

    i = j;
  }

  return `---\n${fixedLines.join('\n')}\n---\n${rest}`;
}

/**
 * Check whether a markdown string's front matter has potential YAML issues.
 * Returns true if the front matter should be re-sanitized.
 */
export function hasFrontMatterIssues(markdown: string): boolean {
  if (!markdown.startsWith('---')) return false;
  const endMatch = markdown.match(/^---\r?\n([\s\S]*?)\n---(\r?\n|$)/);
  if (!endMatch) return true; // No closing delimiter → broken front matter

  const block = endMatch[1];
  const lines = block.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }
    const kv = line.match(/^(\s*)([\w_-]+):\s*(.*)/);
    if (!kv) { i++; continue; }
    const [, indent, , rawValue] = kv;

    // Already block scalar or quoted → fine
    if (
      rawValue === '|' || rawValue === '>' || rawValue === '|-' || rawValue === '>-' ||
      rawValue.startsWith('"') || rawValue.startsWith("'")
    ) { i++; continue; }

    // Check next line: if it looks like a continuation, the YAML is broken
    if (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (next.trim() !== '') {
        const nextKv = next.match(/^(\s*)([\w_-]+):/);
        if (!nextKv || nextKv[1].length > indent.length) {
          return true; // continuation line not in block scalar
        }
      }
    }

    // Check value for unquoted special chars
    if (rawValue && YAML_SPECIAL_CHARS.test(rawValue)) return true;

    i++;
  }
  return false;
}
