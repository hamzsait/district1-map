/**
 * Poll-greeting sign-up counts — https://github.com/hamzsait/district1-map
 *
 * Paste into the sign-up sheet's Apps Script editor (Extensions → Apps Script)
 * and deploy as a web app (Execute as: Me, Who has access: Anyone).
 * Then run setup() once (pick it in the function dropdown → Run) so the
 * answer is precomputed every minute and requests never wait on the sheet.
 *
 * Returns ONLY the machine-readable "PG|v1|<site>|<slots>" cells, e.g.
 *   {"keys":["PG|v1|Millennium Youth Entertainment Complex|2026-10-24 08,09"],"updated":"…"}
 * Names, emails and phone numbers never leave the sheet, so the spreadsheet
 * itself can stay private.
 */
var SHEET_GID = 0;            // tab the Squarespace form writes to
var CACHE_KEY = "pg-keys";

function doGet() {
  var body = CacheService.getScriptCache().get(CACHE_KEY) || refresh();
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

// Reads the sheet and caches the answer. Runs every minute via setup()'s
// trigger (and on demand if the cache is ever empty).
function refresh() {
  var body = JSON.stringify({ keys: readKeys(), updated: new Date().toISOString() });
  CacheService.getScriptCache().put(CACHE_KEY, body, 21600);   // max 6 h; the trigger replaces it every minute
  return body;
}

// Run once by hand after pasting this file.
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "refresh") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("refresh").timeBased().everyMinutes(1).create();
  refresh();
}

function readKeys() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets().filter(function (s) { return s.getSheetId() === SHEET_GID; })[0] || ss.getSheets()[0];
  var keys = [];
  sheet.getDataRange().getDisplayValues().forEach(function (row) {
    for (var i = 0; i < row.length; i++) {
      var at = String(row[i]).indexOf("PG|v1|");
      if (at !== -1) { keys.push(String(row[i]).slice(at).trim()); break; }
    }
  });
  return keys;
}
