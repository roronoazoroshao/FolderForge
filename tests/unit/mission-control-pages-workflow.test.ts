import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const workflowPath = resolve('.github/workflows/mission-control-pages.yml');

type PagesWorkflow = {
  on: {
    push?: { branches?: string[]; paths?: string[] };
    workflow_dispatch?: unknown;
  };
  jobs: { deploy?: { steps?: Array<{ uses?: string; with?: { command?: string; apiToken?: string; accountId?: string } }> } };
};

describe('Mission Control Pages deployment trigger safety', () => {
  it('does not deploy on workflow-only changes, while preserving dashboard updates and manual dispatch', () => {
    const workflow = YAML.parse(readFileSync(workflowPath, 'utf8')) as PagesWorkflow;

    // Updating a deployment action must not itself cause a production deploy.
    expect(workflow.on.push?.branches).toEqual(['main']);
    expect(workflow.on.push?.paths).toEqual(['src/dashboard/static/**']);
    expect(workflow.on.workflow_dispatch).toBeDefined();
    expect(workflow.jobs.deploy?.steps?.some((step) =>
      step.with?.command === 'pages deploy pages-dist --project-name=folderforge-mission-control',
    )).toBe(true);
  });

  it('uses Wrangler Action v4 without changing the Pages deployment contract', () => {
    const workflow = YAML.parse(readFileSync(workflowPath, 'utf8')) as PagesWorkflow;
    const deploy = workflow.jobs.deploy?.steps?.find((step) => step.with?.command?.startsWith('pages deploy '));

    expect(deploy?.uses).toBe('cloudflare/wrangler-action@v4');
    expect(deploy?.with?.command).toBe('pages deploy pages-dist --project-name=folderforge-mission-control');
    expect(deploy?.with?.apiToken).toBe('${{ secrets.CLOUDFLARE_API_TOKEN }}');
    expect(deploy?.with?.accountId).toBe('${{ secrets.CLOUDFLARE_ACCOUNT_ID }}');
    expect(workflow.on.push?.paths).toEqual(['src/dashboard/static/**']);
  });
});
