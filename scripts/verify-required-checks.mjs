const repository = process.env.GITHUB_REPOSITORY;
const sha = process.env.GITHUB_SHA;
const token = process.env.GITHUB_TOKEN;
const required = ['validate (22.12)', 'validate (24)'];

if (!repository || !sha || !token) {
  throw new Error('GITHUB_REPOSITORY, GITHUB_SHA and GITHUB_TOKEN are required.');
}

const deadline = Date.now() + 10 * 60 * 1_000;
const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
};

while (Date.now() < deadline) {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/commits/${sha}/check-runs?per_page=100`,
    { headers },
  );
  if (!response.ok) {
    throw new Error(`GitHub check lookup failed with HTTP ${response.status}.`);
  }

  const body = await response.json();
  const latest = new Map();
  for (const run of body.check_runs ?? []) {
    if (!required.includes(run.name) || latest.has(run.name)) continue;
    latest.set(run.name, run);
  }

  const failed = required
    .map((name) => latest.get(name))
    .filter((run) => run?.status === 'completed' && run.conclusion !== 'success');
  if (failed.length) {
    throw new Error(
      `Protected CI failed: ${failed.map((run) => `${run.name}=${run.conclusion}`).join(', ')}.`,
    );
  }

  if (required.every((name) => latest.get(name)?.conclusion === 'success')) {
    console.log(`Protected CI passed on ${sha}: ${required.join(', ')}.`);
    process.exit(0);
  }

  console.log(`Waiting for protected CI on ${sha}...`);
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}

throw new Error(`Timed out waiting for protected CI on ${sha}.`);
