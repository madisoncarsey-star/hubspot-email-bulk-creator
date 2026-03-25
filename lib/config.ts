const parseEnv = (name: string) => process.env[name]?.trim() || "";

export function resolveToken(tokenFromRequest: string) {
  return tokenFromRequest.trim() || parseEnv("HUBSPOT_PRIVATE_APP_TOKEN");
}
