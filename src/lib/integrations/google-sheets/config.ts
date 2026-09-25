export type GoogleSheetsReadConfig = {
  spreadsheetId: string;
};

function requireServerEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export function getGoogleSheetsReadConfig(): GoogleSheetsReadConfig {
  return {
    spreadsheetId: requireServerEnv("GOOGLE_SHEETS_SPREADSHEET_ID"),
  };
}
