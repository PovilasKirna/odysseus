// @ts-check
'use strict';

// Conventional-Commits PR-title parsing, shared by the title check and the
// description check (which relaxes some rules per type).

/** Types accepted in a PR title. */
const ALLOWED_TYPES = ['feat', 'fix', 'docs', 'chore', 'test', 'ci', 'refactor', 'perf', 'revert', 'build', 'style'];

/** Types for which a "How to Test" section isn't required. */
const TYPES_SKIP_HOWTO = ['docs', 'chore', 'ci'];

/** Types that map to a `type: <t>` label (others validate-pass but get no label). */
const LABELED_TYPES = ['feat', 'fix', 'docs', 'chore', 'test', 'ci', 'refactor'];

const TITLE_RE = new RegExp(`^(${ALLOWED_TYPES.join('|')})(\\(([^)]+)\\))?(!)?:\\s+(\\S.*)$`);

/**
 * Parse a Conventional-Commits PR title.
 * @param {string} title
 * @returns {{ type: string, scope: string|null, breaking: boolean, subject: string } | null}
 */
function parseTitle(title) {
  const m = (title ?? '').trim().match(TITLE_RE);
  if (!m) return null;
  return { type: m[1], scope: m[3] ?? null, breaking: m[4] === '!', subject: m[5].trim() };
}

/** Label name for a type, or null if the type isn't labeled. */
function labelFor(type) {
  return LABELED_TYPES.includes(type) ? `type: ${type}` : null;
}

module.exports = { ALLOWED_TYPES, TYPES_SKIP_HOWTO, LABELED_TYPES, TITLE_RE, parseTitle, labelFor };
