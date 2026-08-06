import securityPolicy from "../../security-headers.json" with { type: "json" };

/** Browser-enforced companion to the Kids site's dependency and source gates. */
export const KIDS_SECURITY_HEADERS = Object.freeze(
  securityPolicy.headers.map((header) => Object.freeze({ ...header })),
);

const contentSecurityPolicy = KIDS_SECURITY_HEADERS.find(
  (header) => header.key === "Content-Security-Policy",
);
if (contentSecurityPolicy === undefined) {
  throw new Error("The isolated Kids site has no Content-Security-Policy header.");
}

export const KIDS_CONTENT_SECURITY_POLICY = contentSecurityPolicy.value;
