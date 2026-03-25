const parseEnv = (name: string) => process.env[name]?.trim() || "";

export const envConfig = {
  defaultFromName: parseEnv("DEFAULT_FROM_NAME"),
  defaultReplyToEmail: parseEnv("DEFAULT_REPLY_TO_EMAIL"),
  defaultFolderId: parseEnv("DEFAULT_FOLDER_ID"),
  defaultCampaignId: parseEnv("DEFAULT_CAMPAIGN_ID"),
  defaultLanguage: parseEnv("DEFAULT_LANGUAGE") || "en"
};

export function resolveToken(tokenFromRequest: string) {
  return tokenFromRequest.trim() || parseEnv("HUBSPOT_PRIVATE_APP_TOKEN");
}
