import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../ui';

export function ResponsesScreen() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Responses gateway retired"
        subtitle="The legacy model gateway is no longer a supported connection path."
      />
      <Card title="Connect an AI client">
        <div className="grid gap-3">
          <p className="m-0 text-sm text-muted">
            Use Fleet to set up an authorized MCP client. Existing MCP access
            remains separate from the retired model gateway.
          </p>
          <Link
            to="/fleet"
            className="w-fit rounded-lg border border-border px-3 py-2 text-sm text-accent hover:bg-raised focus-visible:outline focus-visible:outline-2"
          >
            Go to Fleet
          </Link>
        </div>
      </Card>
    </div>
  );
}
