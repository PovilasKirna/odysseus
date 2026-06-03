// @ts-check
'use strict';

/** @param {{ github: import('@octokit/rest').Octokit, context: import('@actions/github').context }} */
module.exports = async ({ github, context }) => {
  const body   = context.payload.pull_request.body || '';
  const prNum  = context.payload.pull_request.number;
  const MARKER = '<!-- pr-description-check-bot -->';
  const owner  = context.repo.owner;
  const repo   = context.repo.repo;

  // Strip HTML comments so placeholder text does not count as content.
  function strip(text) {
    return (text ?? '').replace(/<!--[\s\S]*?-->/g, '').trim();
  }

  // Extract the text content of a ## Section.
  function section(heading) {
    const m = body.match(new RegExp(`##\\s+${heading}[\\s\\S]*?(?=\\n##\\s|$)`, 'i'));
    return strip(m?.[0].replace(new RegExp(`##\\s+${heading}`, 'i'), '') ?? '');
  }

  const problems = [];

  // 1. Summary must be filled in.
  if (section('Summary').length < 20) {
    problems.push('**Summary** is empty or too short — describe what changed and why.');
  }

  // 2. Linked Issue must reference a real issue number.
  const linkedSection = section('Linked Issue');
  if (!linkedSection || !/(?:fixes|part of|closes|resolves)\s*#\d+/i.test(linkedSection)) {
    problems.push('**Linked Issue** — add a reference like `Fixes #NNN`, `Part of #NNN`, or `Closes #NNN`.');
  }

  // 3. At least one Type of Change box must be checked.
  const typeBlock = body.match(/##\s+Type of Change[\s\S]*?(?=\n##\s|$)/i)?.[0] ?? '';
  if (!/- \[x\]/i.test(typeBlock)) {
    problems.push('**Type of Change** — check at least one box.');
  }

  // 4. Duplicate-search checklist item must be checked.
  if (!/- \[x\] I searched/i.test(body)) {
    problems.push('**Checklist** — check the duplicate-search box to confirm you searched existing issues and PRs.');
  }

  // 5. How to Test must have at least one numbered step.
  const howTo = section('How to Test');
  if (!howTo || !/\d+\.\s*\S/.test(howTo)) {
    problems.push('**How to Test** — add at least one numbered step a reviewer can follow to verify this works.');
  }

  // ── Comment ──────────────────────────────────────────────────────────────
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner, repo, issue_number: prNum, per_page: 100,
  });
  const existing = comments.find(c => (c.body ?? '').includes(MARKER));

  if (problems.length === 0) {
    // Green pipeline is the signal — no success comment needed. Clean up any prior failure comment.
    if (existing) {
      await github.rest.issues.deleteComment({ owner, repo, comment_id: existing.id });
    }
  } else {
    const commentBody = [
      MARKER,
      '⚠️ **PR description — action needed**',
      '',
      'The following required sections are missing or incomplete. Please update the PR description to address them:',
      '',
      problems.map(p => `- ${p}`).join('\n'),
      '',
      '---',
      '_This comment is deleted automatically once all sections are complete._',
    ].join('\n');

    if (existing) {
      await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body: commentBody });
    } else {
      await github.rest.issues.createComment({ owner, repo, issue_number: prNum, body: commentBody });
    }
  }

  // ── Labels ────────────────────────────────────────────────────────────────
  async function ensureLabel(name, color, description) {
    try {
      await github.rest.issues.createLabel({ owner, repo, name, color, description });
    } catch (e) {
      if (e.status !== 422) throw e;
    }
  }

  async function swapLabel(num, add, remove) {
    await ensureLabel(add.name, add.color, add.description);
    await github.rest.issues.addLabels({ owner, repo, issue_number: num, labels: [add.name] });
    try {
      await github.rest.issues.removeLabel({ owner, repo, issue_number: num, name: remove });
    } catch (e) {
      if (e.status !== 404 && e.status !== 410) throw e;
    }
  }

  if (problems.length === 0) {
    await swapLabel(prNum,
      { name: 'ready for review', color: '0e8a16', description: 'Description complete — ready for maintainer review' },
      'needs work',
    );
  } else {
    await swapLabel(prNum,
      { name: 'needs work', color: 'd93f0b', description: 'PR description incomplete — please update before review' },
      'ready for review',
    );
  }
};
