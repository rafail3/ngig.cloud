import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, THEME_SCRIPT } from "@/components/theme/ThemeProvider";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ngig.cloud"),
  title: {
    default: "ngig Cloud",
    template: "%s — ngig Cloud",
  },
  description:
    "ngig Cloud — serviciul tău profesional de cloud, 100% rapid și sigur.",
  applicationName: "ngig Cloud",
  openGraph: {
    type: "website",
    siteName: "ngig Cloud",
    title: "ngig Cloud",
    description:
      "ngig Cloud — serviciul tău profesional de cloud, 100% rapid și sigur.",
    url: "https://ngig.cloud",
    locale: "ro_RO",
    images: [{ url: "/ngig-logo.png", alt: "ngig Cloud" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ngig Cloud",
    description:
      "ngig Cloud — serviciul tău profesional de cloud, 100% rapid și sigur.",
    images: ["/ngig-logo.png"],
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
