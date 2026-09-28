/**
 * Poll-greeting sign-up counts — https://github.com/hamzsait/district1-map
 *
 * Paste into the sign-up sheet's Apps Script editor (Extensions → Apps Script),
 * then:
 *   1. Run setup() once (function dropdown → setup → Run).
 *   2. Deploy → Manage deployments → pencil → Version: New version → Deploy
 *      (keeps the same URL). First time only: Deploy → New deployment → Web app,
 *      Execute as: Me, Who has access: Anyone.
 *
 * Returns ONLY the machine-readable "PG|v1|<site>|<slots>" cells, e.g.
 *   {"keys":["PG|v1|Millennium Youth Entertainment Complex|2026-10-24 08,09"],"updated":"…"}
 * Names, emails and phone numbers never leave the sheet, so the spreadsheet
 * itself can stay private.
 *
 * Freshness: every request re-reads the sheet unless another request did so in
 * the last few seconds, so a new sign-up shows up on the map right away. The
 * short cache only absorbs bursts (many visitors loading at once).
 */
var SHEET_GID  = 0;           // tab the Squarespace form writes to
var CACHE_KEY  = "pg-keys";
var MAX_AGE_MS = 5000;        // reuse an answer at most this old

function doGet() {
  var hit = CacheService.getScriptCache().get(CACHE_KEY);
  if (hit) {
    try { if (Date.now() - JSON.parse(hit).t < MAX_AGE_MS) return json(hit); } catch (e) {}
  }
  return json(refresh());
}

function json(body) {
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

// Reads the sheet and caches the answer.
function refresh() {
  var body = JSON.stringify({ keys: readKeys(), updated: new Date().toISOString(), t: Date.now() });
  CacheService.getScriptCache().put(CACHE_KEY, body, 21600);
  return body;
}

// Run once by hand. Adds a 1-minute trigger that runs the script regularly
// (keeps it warm so visitors hit fewer slow "cold start" responses).
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
  var last = sheet.getLastRow();
  if (last < 1) return [];
  var keys = [];
  sheet.getRange(1, 1, last, sheet.getLastColumn()).getValues().forEach(function (row) {
    for (var i = row.length - 1; i >= 0; i--) {       // the key is in the last text column; scan right-to-left
      var v = String(row[i]), at = v.indexOf("PG|v1|");
      if (at !== -1) { keys.push(v.slice(at).trim()); break; }
    }
  });
  return keys;
}
