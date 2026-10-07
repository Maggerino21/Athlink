import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import './globals.css';

/**
 * **Archivo, not Inter.**
 *
 * Inter is the default of every generated dashboard on the internet, and a
 * product whose argument is "we build better software than the incumbent"
 * cannot open in the house typeface of software that was not designed at all.
 * Archivo is a grotesque with actual drawing in it — flat-sided bowls, a tall
 * x-height, numerals with weight — and it is already the display face on the
 * phone, so the two apps read as siblings without being copies.
 *
 * Loaded variable (100–900) because the layout leans on the extremes: hairline
 * weights at 80px for the figures, medium at 11px for labels.
 */
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['wdth'],
});

export const metadata: Metadata = {
  title: 'Athlink Staff',
  description: 'Athlink staff dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} h-full`} style={{ fontFamily: 'var(--font-display), -apple-system, sans-serif' }}>
      {/* The ground is `html, body` in globals.css — a fill here would paint
          over the canvas gradient. */}
      <body className="h-full" style={{ color: 'var(--text-primary)' }}>
        {children}
      </body>
    </html>
  );
}
