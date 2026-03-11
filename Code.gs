function doPost(e) {
  // Lock to prevent concurrent overwrites
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const entrySheet = ss.getSheetByName("answers");
    
    // --- SEARCH LOGIC ---
    if (data.action === "search") {
      const rows = entrySheet.getDataRange().getValues();
      let foundReport = null;

      // Loop backwards to find the most recent entry
      for (let i = rows.length - 1; i >= 1; i--) {
        const row = rows[i];
        // Col B (1) is Name, Col C (2) is Stone Number
        if (String(row[1]).trim().toLowerCase() === String(data.name).trim().toLowerCase() && 
            String(row[2]).trim() === String(data.stoneNumber).trim()) {
          
          foundReport = {
            studentName: row[1],
            stoneNumber: row[2],
            shape: row[3],
            carat: row[4],
            clarity: row[5],
            color: row[6],
            fluorescence: row[7],
            measMax: row[8],
            measMin: row[9],
            measAvg: row[10],
            measHeight: row[11],
            propDepth: row[12],
            gradeDepth: row[13],
            propTable: row[14],
            gradeTable: row[15],
            propPavilion: row[16],
            gradePavilion: row[17],
            propGirdle: row[18],
            gradeGirdle: row[19],
            propCrownH: row[20],
            gradeCrownH: row[21],
            propCrownA: row[22],
            gradeCrownA: row[23],
            gradeFinalProp: row[24],
            culetCondition: row[25],
            gradePolish: row[26],
            gradeSym: row[27],
            inclusions: row[28],
            imageUrl: row[29],
            symmetryVariations: row[30],
            inclusionsData: row[31]
          };
          break;
        }
      }

      // If found, run the comparison logic to generate the breakdown
      const result = foundReport
        ? compareWithDatabase(foundReport, ss) 
        : { success: false, message: "Report not found." };
      
      // Attach the raw report data to the result in case the frontend needs it (e.g. for images)
      if (foundReport) result.report = foundReport;

      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- 1. Log Student Entry ---
    const timestamp = new Date();
    
    // Construct the row with all fields including new proportion grades
    const entryRow = [
      timestamp,                  // Column A: Timestamp
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
      data.imageUrl,              // Column AD
      data.symmetryVariations,    // Column AE (New)
      data.inclusionsData         // Column AF (New)
    ];
    
    entrySheet.appendRow(entryRow);
    
    // --- 2. Compare with Database (Refactored) ---
    let result = compareWithDatabase(data, ss);
    
    // If successful comparison, log the accuracy to the results sheet
    if (result.success && result.overallAccuracy !== undefined) {
      // Original logic for logging mismatch details
      const breakdown = result.breakdown;
      const overallAccuracy = result.overallAccuracy;
      
      // Reconstruct the logic for logging mismatch details that was inside doPost
      /* 
         Note: The compareWithDatabase function returns the breakdown array.
         We can iterate over it here to log to "results" sheet just like before.
      */
       
      const mismatchDetails = breakdown
        .filter(item => parseFloat(item.accuracy) < 100)
        .map(item => {
            let userStr = item.userValue;
            if (item.userGrade) userStr += ` (${item.userGrade})`;
            let dbStr = item.correctValue;
            if (item.correctGrade) dbStr += ` (${item.correctGrade})`;
            return `${item.field}: Student(${userStr}) vs DB(${dbStr})`;
          })
        .join(", ");

      const compSheet = ss.getSheetByName("results");
      compSheet.appendRow([
        timestamp,
        data.studentName,
        data.stoneNumber,
        overallAccuracy.toFixed(1) + "%",
        mismatchDetails
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Core grading logic used by both Search and Submit
 */
function compareWithDatabase(data, ss) {
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
    
    if (!dbStone) {
       return { success: true, message: "Data loaded, but Stone Number not found in correct answer database.", breakdown: [] };
    }

    // --- Comparison Logic ---
      const gradeRank = {
        'poor': 0, 'fair': 1, 'good': 2, 'verygood': 3, 'excellent': 4, 'ideal': 5
      };
      const clarityRank = {
        'i3': 0, 'i2': 1, 'i1': 2, 'si2': 3, 'si1': 4, 'vs2': 5, 'vs1': 6, 'vvs2': 7, 'vvs1': 8, 'if': 9, 'fl': 10
      };
      const colorRank = {};
      // D is highest (22), Z is lowest (0)
      for (let i = 0; i < 23; i++) {
        colorRank[String.fromCharCode(90 - i).toLowerCase()] = i;
      }
      const culetRank = {
        // Higher rank = better condition. Pointed/None are top tier.
        // Accuracy is calculated by the distance between ranks (0-3 scale).
        'pointed': 8, 'none': 7, 'verysmall': 6, 'small': 5, 'medium': 4, 'large': 3,
        'abraded': 2, 'chipped': 1, 'damaged': 0
      };
      const fluorescenceRank = {
        'none': 4, 'veryslight': 3, 'slight': 2, 'strong': 1, 'verystrong': 0
      };

      const normalizeString = (str, field) => {
        let normalized = String(str || "").trim().toLowerCase();
        // For culet, "small" and "small faceted" should be the same.
        if (field === 'Culet') {
            normalized = normalized.replace('faceted', '').replace(/[()]/g, '').trim();
        }
        // General normalization for all fields after specific rules
        return normalized.replace(/\s+/g, '');
      };

      const breakdown = [];

      // Helper to compare values and calculate accuracy
      const compareAndScore = (field, userValue, dbIndex, userGrade, dbGradeIndex, isNumeric, isAngle, isPercentage) => {
        if (dbIndex >= dbStone.length) return; // Safety check

        const dbValue = dbStone[dbIndex]
        let accuracy = 0;
        const dbGradeForDisplay = (dbGradeIndex !== null && dbGradeIndex < dbStone.length) ? dbStone[dbGradeIndex] : "";

        // --- String-only comparison (no grades) ---
        if (!isNumeric && dbGradeIndex === null) {
            const uStr = normalizeString(userValue, field);
            const dStr = normalizeString(dbValue, field);

            let rankMap = null;
            if (field === 'Clarity') rankMap = clarityRank;
            if (field === 'Color') rankMap = colorRank;
            if (field === 'Culet') rankMap = culetRank;
            if (field === 'Fluorescence') rankMap = fluorescenceRank;
            if (field === 'Polish' || field === 'Symmetry' || field === 'Final Prop Grade') rankMap = gradeRank;

            // Special case for Carat: if not treated as numeric range, treat as exact
            if (field === 'Carat' && isNumeric) rankMap = null; 

            if (rankMap) {
                const userRank = rankMap.hasOwnProperty(uStr) ? rankMap[uStr] : -1;
                const dbRank = rankMap.hasOwnProperty(dStr) ? rankMap[dStr] : -1;

                if (userRank !== -1 && dbRank !== -1) {
                    const rankDiff = Math.abs(userRank - dbRank);
                    if (rankDiff === 0) {
                        accuracy = 100;
                    } else if (rankDiff >= 3) { // 3 or more grades apart is 0%
                        accuracy = 0;
                    } else { // Interpolate for 1 or 2 grades apart
                        accuracy = 100 * (1 - (rankDiff / 3.0));
                    }
                } else if (uStr === dStr) { // Fallback for values not in rank map
                    accuracy = 100;
                }
            } else if (uStr === dStr) { // Not a ranked string, just direct comparison
                accuracy = 100;
            }
        }
        // --- Numeric and Grade-based comparison ---
        else {
            const uVal = parseFloat(userValue || 0);
            const dVal = parseFloat(dbValue || 0);

            // Handle non-numeric inputs gracefully
            if (isNumeric && (isNaN(uVal) || isNaN(dVal) || dVal === 0)) {
                if (uVal === dVal || (String(userValue) === String(dbValue)) || (isNaN(uVal) && isNaN(dVal))) {
                    accuracy = 100;
                } else {
                    accuracy = 0;
                }
            } else {
                // Define limits: Carat uses 0.01/0.02, others use 2/4 or 2%/4%
                const softLimit = field === 'Carat' ? 0.01 : (isAngle ? 2 : (isPercentage ? 2 : dVal * 0.02)); // Carat soft limit: 0.01ct
                const hardLimit = field === 'Carat' ? 0.03 : (isAngle ? 4 : (isPercentage ? 4 : dVal * 0.04)); // Carat hard limit: 0.03ct (was 0.02)
                const numericDiff = isNumeric ? Math.abs(uVal - dVal) : 0;

                const normUserGrade = normalizeString(userGrade);
                const normDbGrade = normalizeString(dbGradeForDisplay);
                const userRank = gradeRank.hasOwnProperty(normUserGrade) ? gradeRank[normUserGrade] : -1;
                const dbRank = gradeRank.hasOwnProperty(normDbGrade) ? gradeRank[normDbGrade] : -1;
                
                let gradeDiff = 99; // Assume large difference
                if (userRank !== -1 && dbRank !== -1) {
                    gradeDiff = Math.abs(userRank - dbRank);
                } else if (normUserGrade === normDbGrade) {
                    gradeDiff = 0; // Non-ranked grades match exactly
                }
                
                // Case 1: Hard Fail (0% accuracy)
                if ((isNumeric && numericDiff >= hardLimit) || gradeDiff >= 3) {
                    accuracy = 0;
                }
                // Case 2: Perfect Score (100% accuracy)
                else if ((!isNumeric || numericDiff <= softLimit) && gradeDiff === 0) {
                    accuracy = 100;
                }
                // Case 3: Interpolation
                else {
                    // Numeric score: 1.0 if within soft limit, 0.0 at hard limit, linear in between.
                    let numericScore = 1.0;
                    if (isNumeric && numericDiff > softLimit) {
                        numericScore = 1 - ((numericDiff - softLimit) / (hardLimit - softLimit));
                    }
                    
                    // Grade score: 1.0 for same grade, 0.0 for 3 grades apart, linear in between.
                    const gradeScore = 1 - (gradeDiff / 3.0);

                    // Final accuracy is the product of both scores.
                    accuracy = 100 * numericScore * gradeScore;
                }
            }
        }

        breakdown.push({
          field: field,
          userValue: userValue || "N/A",
          correctValue: dbValue || "N/A",
          userGrade: userGrade || "",
          correctGrade: dbGradeForDisplay || "",
          accuracy: Math.max(0, accuracy).toFixed(0)
        });
      };
      
      // MAPPING: Call the new comparison function for each field.
      // compareAndScore(Field Name, User Value, DB Value Index, User Grade, DB Grade Index, isNumeric, isAngle, isPercentage)
      compareAndScore("Shape", data.shape, 1, null, null, false, false, false);
      compareAndScore("Carat", data.carat, 2, null, null, true, false, false);
      compareAndScore("Color", data.color, 3, null, null, false, false, false);
      compareAndScore("Clarity", data.clarity, 4, null, null, false, false, false);
      compareAndScore("Fluorescence", data.fluorescence, 5, null, null, false, false, false);
      
      compareAndScore("Depth %", data.propDepth, 10, data.gradeDepth, 11, true, false, true);
      compareAndScore("Table %", data.propTable, 12, data.gradeTable, 13, true, false, true);
      compareAndScore("Pavilion %", data.propPavilion, 14, data.gradePavilion, 15, true, false, true);
      compareAndScore("Girdle %", data.propGirdle, 16, data.gradeGirdle, 17, true, false, true);
      compareAndScore("Crown H %", data.propCrownH, 18, data.gradeCrownH, 19, true, false, true);
      compareAndScore("Crown A (°)", data.propCrownA, 20, data.gradeCrownA, 21, true, true, false);
      
      compareAndScore("Final Prop Grade", data.gradeFinalProp, 22, null, null, false, false, false);
      compareAndScore("Culet", data.culetCondition, 23, null, null, false, false, false);
      compareAndScore("Polish", data.gradePolish, 24, null, null, false, false, false);
      compareAndScore("Symmetry", data.gradeSym, 25, null, null, false, false, false);

      // Calculate overall accuracy
      const totalAccuracy = breakdown.reduce((sum, item) => sum + parseFloat(item.accuracy), 0);
      const overallAccuracy = breakdown.length > 0 ? totalAccuracy / breakdown.length : 0;

      return {
        success: true,
        message: `Grading Report. Overall Accuracy: ${overallAccuracy.toFixed(1)}%`,
        overallAccuracy: overallAccuracy,
        breakdown: breakdown
      };
}
