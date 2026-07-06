import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "vi", "id"],
  defaultLocale: "en",
  // en lives at the root without a prefix; vi/id get /vi and /id.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
