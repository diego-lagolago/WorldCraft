import { z } from "zod";
import { CONTENT_VISIBILITIES, VISIBILITY_STATUSES } from "./types";

export const contentVisibilitySchema = z.enum(CONTENT_VISIBILITIES);
export const visibilityStatusSchema = z.enum(VISIBILITY_STATUSES);
