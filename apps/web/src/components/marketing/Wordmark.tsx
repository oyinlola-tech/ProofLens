export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span translate="no" className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden="true" className="relative inline-block size-[18px] rounded-full border-[2.5px] border-current">
        <span className="absolute inset-[3px] rounded-full bg-accent" />
      </span>
      <span className="font-display text-[19px] font-semibold tracking-tight">ProofLens</span>
    </span>
  );
}
