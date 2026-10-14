/**
 * AI Job Application Automation — Google Sheets Live Sync Script
 * 
 * SPREADSHEET SETUP INSTRUCTIONS:
 * 1. In your Google Sheet ("AI Job Application Automation"), click "Extensions" > "Apps Script".
 * 2. Delete any existing code in the editor, and paste this entire code.
 * 3. Select the function "setupSheet" from the toolbar dropdown and click "Run" (this will format headers and clear old dummy rows).
 * 4. Click "Deploy" > "Manage deployments" > click the pencil (Edit) icon.
 * 5. Under "Version", select "New version", and click "Deploy".
 */

function setupSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // 1. Clear any existing misaligned or dummy rows
  sheet.clear();
  
  // 2. Define standard application columns
  var headers = [
    "Timestamp", 
    "Application ID", 
    "Company", 
    "Job / Project Title", 
    "Location", 
    "Remote Type", 
    "Employment Type", 
    "Salary / Contract Rate", 
    "Match Score %", 
    "Status", 
    "Source URL"
  ];
  
  // 3. Write headers to Row 1
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // 4. Style Header Row (Dark Slate / Electric Blue, Bold, Centered)
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#0f172a");
  headerRange.setFontColor("#38bdf8");
  headerRange.setFontWeight("bold");
  headerRange.setFontSize(10);
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  
  // 5. Freeze Row 1 and adjust row height
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 38);
  
  // 6. Set column widths for readability
  sheet.setColumnWidth(1, 160); // Timestamp
  sheet.setColumnWidth(2, 120); // Application ID
  sheet.setColumnWidth(3, 200); // Company
  sheet.setColumnWidth(4, 260); // Job Title
  sheet.setColumnWidth(5, 140); // Location
  sheet.setColumnWidth(6, 120); // Remote Type
  sheet.setColumnWidth(7, 140); // Employment Type
  sheet.setColumnWidth(8, 200); // Salary
  sheet.setColumnWidth(9, 110); // Match Score
  sheet.setColumnWidth(10, 110); // Status
  sheet.setColumnWidth(11, 280); // Source URL
  
  Logger.log("Google Sheet initialized successfully with styled headers!");
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Auto-setup headers if row 1 is empty or doesn't have "Timestamp"
    var firstCell = sheet.getRange("A1").getValue();
    if (!firstCell || firstCell.toString().indexOf("Timestamp") === -1) {
      setupSheet();
    }
    
    // Parse incoming data (JSON or Form URL Encoded)
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }
    
    // Support batch rows
    if (data.batch && Array.isArray(data.batch)) {
      for (var i = 0; i < data.batch.length; i++) {
        appendSingleRecord(sheet, data.batch[i]);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Batch of " + data.batch.length + " applications logged successfully."
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Single application append
    var rowValues = appendSingleRecord(sheet, data);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Application recorded successfully.",
      row: rowValues
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function appendSingleRecord(sheet, data) {
  var rowValues = [];
  if (data.row && Array.isArray(data.row)) {
    rowValues = data.row;
  } else {
    var timestamp = data.timestamp || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    var id = data.id || "APP_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    var company = data.company || "Target Company";
    var title = data.title || data.role || "Software Engineer";
    var location = data.location || "Remote";
    var remoteType = data.remoteType || "Remote";
    var jobType = data.jobType || "Full-Time";
    var salary = data.salaryRaw || data.salary || "Competitive Pay";
    var matchScore = data.matchScore ? (data.matchScore.toString().includes("%") ? data.matchScore : data.matchScore + "%") : "93%";
    var status = data.status || "Applied";
    var url = data.url || "";
    
    rowValues = [timestamp, id, company, title, location, remoteType, jobType, salary, matchScore, status, url];
  }
  
  sheet.appendRow(rowValues);
  
  var lastRow = sheet.getLastRow();
  sheet.setRowHeight(lastRow, 28);
  var dataRange = sheet.getRange(lastRow, 1, 1, rowValues.length);
  dataRange.setFontFamily("Roboto").setFontSize(9);
  
  // Color code status column
  var statusCell = sheet.getRange(lastRow, 10);
  var statusVal = (statusCell.getValue() || "").toString().toLowerCase();
  if (statusVal.indexOf("applied") !== -1) {
    statusCell.setFontColor("#16a34a").setFontWeight("bold");
  } else if (statusVal.indexOf("review") !== -1) {
    statusCell.setFontColor("#eab308").setFontWeight("bold");
  }
  
  return rowValues;
}

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var totalRows = Math.max(0, sheet.getLastRow() - 1);
  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    sheet_title: SpreadsheetApp.getActiveSpreadsheet().getName(),
    active_tab: sheet.getName(),
    total_applications: totalRows,
    timestamp: new Date().toISOString(),
    message: "Google Sheets Sync Webhook is live and healthy."
  })).setMimeType(ContentService.MimeType.JSON);
}
