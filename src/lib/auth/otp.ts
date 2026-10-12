/** Generate a numeric OTP of the given length (default 6). */
export function generateOtp(length = 6): string {
  let otp = "";
  for (let i = 0; i < length; i++) otp += Math.floor(Math.random() * 10);
  return otp;
}

/** OTP expiry timestamp — `minutes` from now (default 10). */
export function otpExpiry(minutes = 10): Date {
  return new Date(Date.now() + minutes * 60_000);
}
