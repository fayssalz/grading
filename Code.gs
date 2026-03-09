function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    
    // Prepare the row data
    var rowData = [
      new Date(),                 // Column A: Timestamp
      data.studentName,           // Column B
      data.stoneNumber,           // Column C
      data.shape,                 // Column D
      data.carat,                 // Column E
      data.clarity,               // Column F
      data.color,                 // Column G
      data.fluorescence,          // Column H
      
      // Measurements
      data.measMax,               // Column I
      data.measMin,               // Column J
      data.measAvg,               // Column K
      data.measHeight,            // Column L
      
      // Proportions
      data.propDepth,             // Column M
      data.gradeDepth,            // Column N
      data.propTable,             // Column O
      data.gradeTable,            // Column P
      data.propPavilion,          // Column Q
      data.gradePavilion,         // Column R
      data.propGirdle,            // Column S
      data.gradeGirdle,           // Column T
      data.propCrownH,            // Column U
      data.gradeCrownH,           // Column V
      data.propCrownA,            // Column W
      data.gradeCrownA,           // Column X
      
      // Grades
      data.gradeFinalProp,        // Column Y
      data.gradePolish,           // Column Z
      data.culetCondition,        // Column AA (New Field: Culet Condition)
      data.gradeSym,              // Column AB
      
      // Inclusions & Image
      data.inclusions,            // Column AC
      data.imageUrl               // Column AD
    ];
    
    sheet.appendRow(rowData);
    
    return ContentService.createTextOutput(JSON.stringify({
      "result": "success",
      "message": "Grading report submitted successfully!"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "result": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}