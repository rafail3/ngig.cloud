import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";

/* What crawlers may look at.

   Almost nothing here is public: the drive, the dashboard and the API all sit
   behind a session, and a share link is a private capability that happens to
   be reachable by URL. Those are listed explicitly rather than left to the
   redirect — a crawler that never requests them is better than one that gets
   bounced to /login and indexes THAT under a hundred different paths.

   The share links matter most. They are already `noindex` in the page's own
   metadata, but that tag is only read after the page is fetched, and a fetch
   is what counts as an access. Disallowing the prefix means a well-behaved
   crawler never touches the link at all. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/dashboard", "/s/", "/confirm-email"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
