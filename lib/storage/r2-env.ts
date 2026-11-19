export type R2Settings = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

export function readR2Settings(env: NodeJS.ProcessEnv = process.env): R2Settings | null {
  const accountId = env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucket = env.R2_BUCKET_NAME?.trim() ?? "";
  const endpoint = (env.R2_ENDPOINT?.trim() || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")).replace(/\/$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint.startsWith("https://")) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket, endpoint };
}
