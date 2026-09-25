export type GoogleSheetsReadConfig = {
  spreadsheetId: string;
  serviceAccountEmail: string;
  privateKey: string;
};

function requireServerEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

export function getGoogleSheetsReadConfig(): GoogleSheetsReadConfig {
  return {
    spreadsheetId: requireServerEnv("GOOGLE_SHEETS_SPREADSHEET_ID"),
    serviceAccountEmail: requireServerEnv("GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL"),
    privateKey: normalizePrivateKey(requireServerEnv("GOOGLE_SHEETS_PRIVATE_KEY")),
  };
}
