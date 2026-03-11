function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // --- 1. Log Student Entry ---
    const entrySheet = ss.getSheetByName("answers");
    const timestamp = new Date();
    
    // Construct the row with all fields including new proportion grades
    const entryRow = [
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
      data.culetCondition,        // Column Z (New Field: Culet Condition)
      data.gradePolish,           // Column AA
      data.gradeSym,              // Column AB

      // Inclusions & Image
      data.inclusions,            // Column AC
      data.imageUrl               // Column AD
    ];
    
    entrySheet.appendRow(entryRow);
    
    // --- 2. Compare with Database ---
    const dbSheet = ss.getSheetByName("database");
    const dbData = dbSheet.getDataRange().getValues();
    
    // Find the stone in the database (Assuming Column A [Index 0] is Stone Number)
    let dbStone = null;
    // Start at i=1 to skip headers
    for (let i = 1; i < dbData.length; i++) {
      if (String(dbData[i][0]) === String(data.stoneNumber)) {
        dbStone = dbData[i];
        break;
      }
    }
    
    let result = { status: "success", message: "Entry saved.", accuracy: "N/A" };
    
    if (dbStone) {
      // --- Comparison Logic ---
      // NOTE: Adjust the indices (dbIndex) below to match your actual "stones database" columns.
      // Example: If 'Shape' is in Column B, index is 1.
      
      let matches = 0;
      let totalChecks = 0;
      let details = [];

      const check = (name, studentVal, dbIndex) => {
        // Safety check if DB doesn't have this column
        if (dbIndex >= dbStone.length) return;
        
        totalChecks++;
        const dbVal = dbStone[dbIndex];
        
        // Normalize strings for comparison (trim whitespace, ignore case)
        const sNorm = String(studentVal || "").toLowerCase().trim();
        const dNorm = String(dbVal || "").toLowerCase().trim();
        
        if (sNorm === dNorm) {
          matches++;
        } else {
          details.push(`${name}: Student(${studentVal}) vs DB(${dbVal})`);
        }
      };

      // MAPPING: Update these numbers based on your Database Sheet Columns
      check("Shape", data.shape, 1);
      check("Carat", data.carat, 2);
      check("Color", data.color, 3);
      check("Clarity", data.clarity, 4);
      check("Fluorescence", data.fluorescence, 5);
      check("Meas Max", data.measMax, 6);
      check("Meas Min", data.measMin, 7);
      check("Meas Avg", data.measAvg, 8);
      check("Meas Height", data.measHeight, 9);
      check("Depth %", data.propDepth, 10);
      check("Depth Grade", data.gradeDepth, 11);
      check("Table %", data.propTable, 12);
      check("Table Grade", data.gradeTable, 13);
      check("Pavilion %", data.propPavilion, 14);
      check("Pavilion Grade", data.gradePavilion, 15);
      check("Girdle %", data.propGirdle, 16);
      check("Girdle Grade", data.gradeGirdle, 17);
      check("Crown H", data.propCrownH, 18);
      check("Crown H Grade", data.gradeCrownH, 19);
      check("Crown A", data.propCrownA, 20);
      check("Crown A Grade", data.gradeCrownA, 21);
      check("Final Prop Grade", data.gradeFinalProp, 22);
      check("Culet", data.culetCondition, 23);
      check("Polish", data.gradePolish, 24);
      check("Symmetry", data.gradeSym, 25);

      const accuracy = totalChecks > 0 ? (matches / totalChecks) * 100 : 0;
      result.accuracy = accuracy.toFixed(2);
      result.message = `Entry saved. Accuracy: ${result.accuracy}%`;

      // --- 3. Log Comparison ---
      const compSheet = ss.getSheetByName("results");
      compSheet.appendRow([
        timestamp,
        data.studentName,
        data.stoneNumber,
        result.accuracy + "%",
        details.join(", ")
      ]);
    } else {
      result.message = "Entry saved, but Stone Number not found in database.";
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
