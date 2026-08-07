import type { Metadata, Viewport } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  SITE_NAME,
  SITE_DESCRIPTION,
  SITE_URL,
  CHROME_DARK,
  CHROME_LIGHT,
} from "@/lib/brand";
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

/* Site-wide metadata. The brand is written "ngig.cloud" everywhere now, as the
   mark and the wordmark say it — the old "ngig Cloud" spelling survived only
   here. The preview images are NOT listed: `opengraph-image.tsx` beside this
   file provides them, and naming an `images` array here would override that
   generated card with a flat logo. */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "ro_RO",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

/* The colour the OS paints around the page — the phone's status bar, the
   desktop title bar of an installed window. Two entries, because the app
   themes itself: without the media queries a light-mode user gets a black bar
   above a white page. `viewport`, not `metadata`: that is where Next moved
   themeColor, and leaving it in metadata makes it silently do nothing. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: CHROME_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: CHROME_DARK },
  ],
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
