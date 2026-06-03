// @ts-check
'use strict';

const { parseTitle, labelFor, LABELED_TYPES, ALLOWED_TYPES } = require('./lib/pr-type');
const { addLabel, dropLabel } = require('./lib/labels');
const { upsertComment, deleteComment } = require('./lib/comment');

const MARKER = '<!-- pr-title-check -->';
const BREAKING_LABEL = 'breaking change';

// Validate the PR title against Conventional Commits and keep the `type: *`
// labels in sync. Scope is deliberately narrow: this check only manages its own
// comment, the `type: *` labels, and the optional `breaking change` label — it
// never touches `needs work` / `ready for review` (owned by the description
// check), so the two pull_request_target jobs don't fight over labels.
/** @param {{ github: import('@octokit/rest').Octokit, context: import('@actions/github').context, core: import('@actions/core') }} */
module.exports = async ({ github, context, core }) => {
  const pr      = context.payload.pull_request;
  const title   = pr.title || '';
  const num     = pr.number;
  const current = (pr.labels || []).map(l => l.name);
  const repoRef = { owner: context.repo.owner, repo: context.repo.repo };

  const parsed = parseTitle(title);

  if (!parsed) {
    const commentBody = [
      MARKER,
      '⚠️ **PR title — action needed**',
      '',
      'The PR title must follow [Conventional Commits](https://www.conventionalcommits.org): `type(scope)!: subject`.',
      '',
      `Allowed types: ${ALLOWED_TYPES.map(t => '`' + t + '`').join(', ')}.`,
      '',
      'Examples:',
      '- `feat: add Search Everywhere palette`',
      '- `fix(rag): write embedding after re-index`',
      '- `docs: clarify Docker setup`',
      '',
      '---',
      '_This comment is deleted automatically once the title is valid._',
    ].join('\n');
    await upsertComment(github, repoRef, num, MARKER, commentBody);
    core.setFailed(`PR title "${title}" is not a valid Conventional Commit.`);
    return;
  }

  // Valid → clear the bot comment and sync labels.
  await deleteComment(github, repoRef, num, MARKER);

  const want = labelFor(parsed.type); // null for perf/revert/build/style (no label)
  for (const t of LABELED_TYPES) {
    const name = `type: ${t}`;
    if (name !== want && current.includes(name)) {
      await dropLabel(github, repoRef, num, name);
    }
  }
  if (want) {
    await addLabel(github, core, repoRef, num, want);
  }

  // Optional breaking-change label (acts only if a maintainer created it).
  if (parsed.breaking) {
    await addLabel(github, core, repoRef, num, BREAKING_LABEL);
  } else if (current.includes(BREAKING_LABEL)) {
    await dropLabel(github, repoRef, num, BREAKING_LABEL);
  }
};
