import { brandingStyle, type Branding } from "@/lib/branding";

/** Rahmen für alle öffentlichen Buchungsseiten: Farben, Schrift, Hintergrund. */
export function BrandedPage({ org, children, compact }: { org: Branding & { name: string }; children: React.ReactNode; compact?: boolean }) {
  const { className, style } = brandingStyle(org);
  return (
    <div className={`branded ${className}`} style={compact ? { ...style, minHeight: 0 } : style}>
      <div className={compact ? "px-3 py-3" : "mx-auto max-w-5xl px-4 py-10 sm:px-6"}>{children}</div>
    </div>
  );
}

export function BrandHeader({ org, href }: { org: Branding & { name: string }; href?: string }) {
  const content = (
    <span className="flex items-center gap-3">
      {org.logoUrl && <img src={org.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />}
      <span className="text-lg font-semibold">{org.name}</span>
    </span>
  );
  return <div className="mb-6">{href ? <a href={href}>{content}</a> : content}</div>;
}
