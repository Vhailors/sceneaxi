import { umbrellaRequestAuthority } from "../../../../lib/request-authority.js";
import { createOwnSessionRouteRegistration } from "../../../../provider/own-session.js";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const registration = createOwnSessionRouteRegistration(umbrellaRequestAuthority);

export const GET = registration.GET;

export const POST = registration.POST;

export const PUT = registration.PUT;

export const PATCH = registration.PATCH;

export const DELETE = registration.DELETE;

export const HEAD = registration.HEAD;

export const OPTIONS = registration.OPTIONS;
