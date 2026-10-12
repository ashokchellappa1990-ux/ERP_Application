import type { User } from "@prisma/client";

/** Safe user shape exposed to the client (no password hash / OTP). */
export interface PublicUser {
  id: number;
  fullName: string;
  username: string;
  email: string;
  countryCode: string;
  mobile: string;
  role: string;
  status: string;
  businessName: string;
  businessType: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  mobileVerified: boolean;
  lastLoginAt: string | null;
}

export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    fullName: u.fullName,
    username: u.username,
    email: u.email,
    countryCode: u.countryCode,
    mobile: u.mobile,
    role: u.role,
    status: u.status,
    businessName: u.businessName,
    businessType: u.businessType,
    avatarUrl: u.avatarUrl,
    emailVerified: u.emailVerified,
    mobileVerified: u.mobileVerified,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  };
}
