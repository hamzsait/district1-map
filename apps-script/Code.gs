/**
 * Poll-greeting sign-up counts — https://github.com/hamzsait/district1-map
 *
 * Paste into the sign-up sheet's Apps Script editor (Extensions → Apps Script)
 * and deploy as a web app (Execute as: Me, Who has access: Anyone).
 *
 * Returns ONLY the machine-readable "PG|v1|<site>|<slots>" cells, e.g.
 *   {"keys":["PG|v1|Millennium Youth Entertainment Complex|2026-10-24 08,09"],"updated":"…"}
 * Names, emails and phone numbers never leave the sheet, so the spreadsheet
 * itself can stay private.
 */
var SHEET_GID = 0;   // tab the Squarespace form writes to

function doGet() {
  var cache = CacheService.getScriptCache();
  var body = cache.get("pg-keys");
  if (!body) {
    body = JSON.stringify({ keys: readKeys(), updated: new Date().toISOString() });
    cache.put("pg-keys", body, 15);          // at most one sheet read per 15 s
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
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
