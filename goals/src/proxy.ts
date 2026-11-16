import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets, the PWA files and image optimisation.
    "/((?!_next/static|_next/image|icon.svg|apple-icon.png|icons/|manifest.webmanifest|sw.js|robots.txt|offline).*)",
  ],
};
