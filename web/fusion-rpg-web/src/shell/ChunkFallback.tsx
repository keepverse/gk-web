/**
 * T13's Suspense boundary for a lazy-loaded stage, layer or dev surface (GG-38: split by stage and
 * layer, each loads on first use). Deliberately minimal — the chunk itself is small, so this is
 * rarely visible longer than one frame; it exists so a slow connection sees something instead of a
 * blank stage mid-navigation.
 */
export function ChunkFallback({ testId }: { testId: string }) {
  return (
    <div
      data-testid={testId}
      aria-busy="true"
      className="flex min-h-[200px] items-center justify-center rounded-md border border-transparent bg-panel-raised p-5 animate-pulse"
    />
  );
}
