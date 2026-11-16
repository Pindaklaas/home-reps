import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

const ALLOWED_TYPES: EmailOtpType[] = ["magiclink", "email", "recovery"];

/** Landing for email links built with {{ .TokenHash }} (custom Supabase email templates); the default flow uses /auth/callback. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (!token_hash || !type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.redirect(`${origin}/login?error=link`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error || data.user?.email?.toLowerCase() !== serverEnv().OWNER_EMAIL) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=link`);
  }
  return NextResponse.redirect(type === "recovery" ? `${origin}/settings#account` : `${origin}/`);
}
