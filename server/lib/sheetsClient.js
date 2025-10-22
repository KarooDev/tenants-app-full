// server/lib/sheetsClient.js
import { google } from 'googleapis';


const scopes = ['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/drive.readonly'];


const auth = new google.auth.JWT({
email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
key: (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/\\n/g, '\n'),
scopes,
});


export const sheets = google.sheets({ version: 'v4', auth });
// export const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
export const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
if (!SPREADSHEET_ID) {
  console.error('GOOGLE_SHEETS_SPREADSHEET_ID is missing');
  throw new Error('server_env_missing_spreadsheet_id');
}

// Helpers to read/write ranges
export async function readRange(range) {
const { data } = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
return data.values || [];
}


export async function writeRange(range, values) {
return sheets.spreadsheets.values.update({
spreadsheetId: SPREADSHEET_ID,
range,
valueInputOption: 'RAW',
requestBody: { values },
});
}


export async function appendRange(range, values) {
return sheets.spreadsheets.values.append({
spreadsheetId: SPREADSHEET_ID,
range,
valueInputOption: 'RAW',
insertDataOption: 'INSERT_ROWS',
requestBody: { values },
});
}
console.log('SPREADSHEET_ID:', process.env.GOOGLE_SHEETS_SPREADSHEET_ID);