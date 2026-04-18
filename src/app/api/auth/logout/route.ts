import { serialize } from "cookie";

import { AUTH_COOKIE_NAME } from "@/lib/auth";

function shouldUseSecureCookie() {
  return process.env.AUTH_COOKIE_SECURE === "true";
}

export async function POST() {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": serialize(AUTH_COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: shouldUseSecureCookie(),
        path: "/",
        maxAge: 0,
      }),
    },
  });
}
