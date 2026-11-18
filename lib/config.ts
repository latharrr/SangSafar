// Product name lives here only: trademark/domain clearance is still OPEN (PRODUCT.md).
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "SangSafar";
export const TAGLINE = "Your route, your people.";
// Mirror of [auth.email] otp_length in supabase/config.toml (or the hosted project's setting).
export const OTP_LENGTH = Number(process.env.NEXT_PUBLIC_OTP_LENGTH || 6);
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const MODES = ["train", "bus", "flight", "cab"] as const;
export type Mode = (typeof MODES)[number];
