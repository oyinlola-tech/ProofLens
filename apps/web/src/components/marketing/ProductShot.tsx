import Image from "next/image";

/** A real screenshot of the workspace inside a minimal browser frame. */
export function ProductShot({ src, darkSrc, alt, caption, className = "", priority }: { src: string; darkSrc?: string; alt: string; caption?: string; className?: string; priority?: boolean }) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-card">
        <div className="flex h-9 items-center gap-1.5 border-b border-line bg-surface-muted px-3">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-line-strong" />
          <span aria-hidden="true" className="size-2.5 rounded-full bg-line-strong" />
          <span aria-hidden="true" className="size-2.5 rounded-full bg-line-strong" />
          <span className="ml-3 h-5 flex-1 rounded-md bg-line/60" aria-hidden="true" />
        </div>
        <Image src={src} alt={alt} width={1440} height={900} priority={priority} sizes="(max-width: 1024px) 100vw, 60vw" className={`h-auto w-full ${darkSrc ? "light-only" : ""}`} />
        {darkSrc ? <Image src={darkSrc} alt={alt} width={1440} height={900} priority={priority} sizes="(max-width: 1024px) 100vw, 60vw" className="dark-only h-auto w-full" /> : null}
      </div>
      {caption ? <figcaption className="mt-3 text-sm text-ink-tertiary">{caption}</figcaption> : null}
    </figure>
  );
}
