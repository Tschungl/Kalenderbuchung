export const FONT_STYLES = { sans: "Modern", serif: "Klassisch", rounded: "Freundlich" } as const;
export const BUTTON_STYLES = { rounded: "Abgerundet", square: "Eckig", pill: "Pille" } as const;
export const PAGE_THEMES = { light: "Hell", tinted: "Getönt", dark: "Dunkel" } as const;

export type Branding = {
  brandColor: string;
  logoUrl: string | null;
  welcomeTitle: string | null;
  welcomeText: string | null;
  confirmationText: string | null;
  fontStyle: string;
  buttonStyle: string;
  pageTheme: string;
  salutation: string;
};

const FONTS: Record<string, string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Quicksand", system-ui, sans-serif',
};
const RADIUS: Record<string, string> = { rounded: "0.5rem", square: "0", pill: "9999px" };

/** Mischt die Markenfarbe mit Weiß (amount 0..1 = Anteil Markenfarbe). */
export function tint(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * amount + 255 * (1 - amount));
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** CSS-Variablen und Klassen für Buchungsseiten. */
export function brandingStyle(b: Pick<Branding, "brandColor" | "fontStyle" | "buttonStyle" | "pageTheme">) {
  const dark = b.pageTheme === "dark";
  return {
    className: dark ? "brand-dark" : "",
    style: {
      "--brand": b.brandColor,
      "--brand-radius": RADIUS[b.buttonStyle] ?? RADIUS.rounded,
      fontFamily: FONTS[b.fontStyle] ?? FONTS.sans,
      backgroundColor: dark ? "#0f172a" : b.pageTheme === "tinted" ? tint(b.brandColor, 0.08) : "#f8fafc",
      color: dark ? "#e2e8f0" : undefined,
      minHeight: "100vh",
    } as React.CSSProperties,
  };
}
