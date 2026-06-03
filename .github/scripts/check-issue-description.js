// @ts-check
'use strict';

/** @param {{ github: import('@octokit/rest').Octokit, context: import('@actions/github').context }} */
module.exports = async ({ github, context }) => {
  const issue  = context.payload.issue;
  const body   = (issue.body || '').trim();
  const labels = issue.labels.map(l => l.name);
  const owner  = context.repo.owner;
  const repo   = context.repo.repo;

  const isBug     = labels.includes('bug');
  const isFeature = labels.includes('enhancement');

  // Extract a ### Section's text, stripping HTML comments.
  function section(heading) {
    const re = new RegExp(`### ${heading}\\s*([\\s\\S]*?)(?=\\n###|$)`);
    const m  = body.match(re);
    return m ? m[1].replace(/<!--[\s\S]*?-->/g, '').trim() : '';
  }

  const failures = [];

  // ── Common: body must exist ───────────────────────────────────────────────
  if (body.length < 50) {
    failures.push(
      '**Description** — body is empty or too short. ' +
      'Please open the issue using one of the provided templates.',
    );
  }

  // ── Bug-specific ──────────────────────────────────────────────────────────
  if (isBug) {
    if (!section('Install Method')) {
      failures.push('**Install Method** — select how you installed Odysseus');
    }

    if (!section('Operating System')) {
      failures.push('**Operating System** — select your OS');
    }

    const stepsText = section('Steps to Reproduce');
    if (!stepsText || !/\d+\.|[-*]/.test(stepsText)) {
      failures.push('**Steps to Reproduce** — must include at least one numbered or bulleted step');
    }

    if (section('Expected Behaviour').length < 10) {
      failures.push('**Expected Behaviour** — section is empty or too short');
    }

    if (section('Actual Behaviour').length < 10) {
      failures.push('**Actual Behaviour** — section is empty or too short');
    }
  }

  // ── Feature-specific ──────────────────────────────────────────────────────
  if (isFeature) {
    if (!section('Area')) {
      failures.push('**Area** — select which part of the application this affects');
    }

    if (section('Problem or Motivation').length < 20) {
      failures.push(
        '**Problem or Motivation** — section is empty or too short ' +
        '(explain the concrete problem this solves)',
      );
    }

    if (section('Proposed Solution').length < 20) {
      failures.push(
        '**Proposed Solution** — section is empty or too short ' +
        '(describe the change you want to see)',
      );
    }

    if (!section('Are you willing to implement this\\?')) {
      failures.push('**Are you willing to implement this?** — select an option');
    }
  }

  // ── Find existing bot comment to update in-place ──────────────────────────
  const MARKER = '<!-- issue-description-check -->';
  const { data: comments } = await github.rest.issues.listComments({
    owner, repo, issue_number: issue.number,
  });
  const existing = comments.find(c => c.user.type === 'Bot' && c.body.includes(MARKER));

  const LABEL_BAD  = 'needs more info';
  const LABEL_GOOD = 'ready for review';

  if (failures.length === 0) {
    // Clean up any prior failure comment — no success comment needed.
    if (existing) {
      await github.rest.issues.deleteComment({ owner, repo, comment_id: existing.id });
    }

    try {
      await github.rest.issues.removeLabel({ owner, repo, issue_number: issue.number, name: LABEL_BAD });
    } catch (_) { /* label may not be applied */ }

    try {
      await github.rest.issues.addLabels({ owner, repo, issue_number: issue.number, labels: [LABEL_GOOD] });
    } catch (_) { /* label may not exist yet */ }

  } else {
    const list = failures.map(f => `- ${f}`).join('\n');
    const commentBody = [
      MARKER,
      '⚠️ **Issue description is incomplete.** Please update the following sections:',
      '',
      list,
      '',
      '_This comment is deleted automatically once all sections are complete._',
    ].join('\n');

    if (existing) {
      await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body: commentBody });
    } else {
      await github.rest.issues.createComment({ owner, repo, issue_number: issue.number, body: commentBody });
    }

    try {
      await github.rest.issues.removeLabel({ owner, repo, issue_number: issue.number, name: LABEL_GOOD });
    } catch (_) { /* label may not be applied */ }

    try {
      await github.rest.issues.addLabels({ owner, repo, issue_number: issue.number, labels: [LABEL_BAD] });
    } catch (_) { /* label may not exist yet */ }
  }
};
