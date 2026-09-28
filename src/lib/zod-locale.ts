import { z } from "zod";

/** Configures the process-wide German messages used for server-side schemas. */
export function configureZodLocale() {
  z.config(z.locales.de());
}
