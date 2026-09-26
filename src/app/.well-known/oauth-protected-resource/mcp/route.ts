/**
 * RFC 9728 path-suffixed location for the /mcp resource. The 401
 * WWW-Authenticate header advertises this URL, so spec-conformant clients
 * (e.g. CIMD) never fall back to the origin-level document.
 */
export { GET } from "../route";
