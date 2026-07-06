import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, and static assets — but NOT every path
  // containing a dot, since TikTok handles may contain dots (/audit/some.name).
  matcher:
    "/((?!api|_next|_vercel|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|mjs|txt|xml|json|webmanifest|woff2?)$).*)",
};
