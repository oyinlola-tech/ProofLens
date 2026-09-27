import Image from "next/image";

interface PhotoProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  /** Darken for text overlays. */
  scrim?: boolean;
}

/** Self-hosted editorial photograph. Toned to sit with the palette in both themes. */
export function Photo({ src, alt, className = "", priority, sizes = "(max-width: 768px) 100vw, 50vw", scrim }: PhotoProps) {
  return (
    <div className={`overflow-hidden ${className.includes("absolute") ? "" : "relative"} ${className}`}>
      <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="img-tone object-cover" />
      {scrim ? <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/40 to-transparent" /> : null}
    </div>
  );
}
