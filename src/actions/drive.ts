/**
 * Optional Google Drive upload via service account.
 * Env: GOOGLE_SERVICE_ACCOUNT_JSON (raw JSON or path), GOOGLE_DRIVE_FOLDER_ID
 */
import { createSign } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    if (raw.startsWith("{")) {
      return JSON.parse(raw) as ServiceAccount;
    }
    if (existsSync(raw)) {
      return JSON.parse(readFileSync(raw, "utf8")) as ServiceAccount;
    }
  } catch {
    return null;
  }
  return null;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/drive.file",
      aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const sig = b64url(signer.sign(sa.private_key));
  const jwt = `${unsigned}.${sig}`;

  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error ?? `token exchange ${res.status}`);
  }
  return data.access_token;
}

export type DriveUploadResult =
  | { uploaded: true; fileId: string; webViewLink?: string }
  | { uploaded: false; reason: string };

export async function tryUploadToDrive(opts: {
  fileName: string;
  mimeType: string;
  content: string | Buffer;
  folderId?: string;
}): Promise<DriveUploadResult> {
  const folderId =
    opts.folderId?.trim() || process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  const sa = loadServiceAccount();
  if (!sa || !folderId) {
    return {
      uploaded: false,
      reason: "GOOGLE_DRIVE_FOLDER_ID / GOOGLE_SERVICE_ACCOUNT_JSON not set",
    };
  }

  try {
    const token = await getAccessToken(sa);
    const metadata = {
      name: opts.fileName,
      parents: [folderId],
    };
    const boundary = `runpin_${Date.now()}`;
    const bodyParts = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: ${opts.mimeType}`,
      "",
      typeof opts.content === "string" ? opts.content : opts.content.toString("utf8"),
      `--${boundary}--`,
      "",
    ];
    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: bodyParts.join("\r\n"),
      }
    );
    const data = (await res.json()) as {
      id?: string;
      webViewLink?: string;
      error?: { message?: string };
    };
    if (!res.ok || !data.id) {
      throw new Error(data.error?.message ?? `drive upload ${res.status}`);
    }
    return {
      uploaded: true,
      fileId: data.id,
      webViewLink: data.webViewLink,
    };
  } catch (err) {
    return {
      uploaded: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
