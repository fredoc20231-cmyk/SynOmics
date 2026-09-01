export function SynapseWordmark({
  href = "#/synapse",
  testId = "synapse-wordmark",
}: {
  href?: string;
  testId?: string;
}) {
  return (
    <a className="app-wordmark synapse-wordmark-link" href={href} data-testid={testId} aria-label="SYNAPSE-Ω researcher portal">
      SYNAPSE-Ω
    </a>
  );
}
