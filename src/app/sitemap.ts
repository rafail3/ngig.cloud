import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";

/* The pages a stranger can actually reach.

   This is a private cloud, so the list is short by nature: there is no
   marketing site, and `/` is the drive, which redirects to the login for
   anyone without a session. Listing it would advertise a URL that never
   resolves to content — so what is here is the three doors in: sign in, sign
   up with a code, and ask for one.

   `/reset` is deliberately absent. It is public, but it is a step inside a
   flow that starts elsewhere; indexing it invites people to land there with no
   idea how they arrived. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 1 },
    { url: `${SITE_URL}/register`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${SITE_URL}/cere-invitatie`, changeFrequency: "yearly", priority: 0.8 },
  ];
}
