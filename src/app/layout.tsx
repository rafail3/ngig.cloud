import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, THEME_SCRIPT } from "@/components/theme/ThemeProvider";
import { AppToaster } from "@/components/toast/AppToaster";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Cloudul tău privat — fișiere, foldere și partajări, rapid și sigur.";

/* Site-wide metadata. The brand is written "ngig.cloud" everywhere now, as the
   mark and the wordmark say it — the old "ngig Cloud" spelling survived only
   here. The preview images are NOT listed: `opengraph-image.tsx` beside this
   file provides them, and naming an `images` array here would override that
   generated card with a flat logo. */
export const metadata: Metadata = {
  metadataBase: new URL("https://ngig.cloud"),
  title: {
    default: "ngig.cloud",
    template: "%s — ngig.cloud",
  },
  description: DESCRIPTION,
  applicationName: "ngig.cloud",
  openGraph: {
    type: "website",
    siteName: "ngig.cloud",
    title: "ngig.cloud",
    description: DESCRIPTION,
    url: "https://ngig.cloud",
    locale: "ro_RO",
  },
  twitter: {
    card: "summary_large_image",
    title: "ngig.cloud",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      suppressHydrationWarning
      className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Warm up the Turnstile origin so the invisible anti-bot check
            resolves faster (DNS + TLS done before the script/challenge fetch). */}
        <link rel="preconnect" href="https://challenges.cloudflare.com" />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-950 font-sans text-zinc-50">
        {/* No-flash: set the theme class on <html> before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <ThemeProvider>
          {children}
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
