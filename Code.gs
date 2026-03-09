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
    
    let result = { success: false, message: "Entry saved, but an unknown error occurred during comparison." };
    
    if (dbStone) {
      // --- New Comparison & Breakdown Logic ---
      const gradeRank = {
        'poor': 0, 'fair': 1, 'good': 2, 'very good': 3, 'excellent': 4, 'ideal': 5
      };
      const clarityRank = {
        'i3': 0, 'i2': 1, 'i1': 2, 'si2': 3, 'si1': 4, 'vs2': 5, 'vs1': 6, 'vvs2': 7, 'vvs1': 8, 'if': 9, 'fl': 10
      };
      const colorRank = {};
      // D is highest (22), Z is lowest (0)
      for (let i = 0; i < 23; i++) {
        colorRank[String.fromCharCode(90 - i).toLowerCase()] = i;
      }

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
            const uVal = parseFloat(userValue);
            const dVal = parseFloat(dbValue);

            // Handle non-numeric inputs gracefully
            if (isNumeric && (isNaN(uVal) || isNaN(dVal) || dVal === 0)) {
                if (uVal === dVal || (String(userValue) === String(dbValue)) || (isNaN(uVal) && isNaN(dVal))) {
                    accuracy = 100;
                } else {
                    accuracy = 0;
                }
            } else {
                // Define limits based on user request
                const softLimit = isAngle ? 2 : (isPercentage ? 2 : dVal * 0.02); // 2 degrees, 2 points, or 2%
                const hardLimit = isAngle ? 4 : (isPercentage ? 4 : dVal * 0.04); // 4 degrees, 4 points, or 4%
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

      result = {
        success: true,
        message: `Entry saved. Overall Accuracy: ${overallAccuracy.toFixed(1)}%`,
        overallAccuracy: overallAccuracy,
        breakdown: breakdown
      };

      // --- 3. Log Comparison ---
      const compSheet = ss.getSheetByName("results");
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

      compSheet.appendRow([
        timestamp,
        data.studentName,
        data.stoneNumber,
        overallAccuracy.toFixed(1) + "%",
        mismatchDetails
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
