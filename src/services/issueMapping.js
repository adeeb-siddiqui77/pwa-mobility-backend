import { IssueModel } from "../models/IssueSchema.js";

const columnOrder = ["issue", "tyreType", "approach", "patch", "finalService"];

// Utility: get next non-empty column after given column
function getNextColumns(currentCol) {
  const idx = columnOrder.indexOf(currentCol);
  if (idx === -1) return [];
  
  const next = [];
  for (let i = idx + 1; i < columnOrder.length; i++) {
    next.push(columnOrder[i]); // next possible columns
  }
  return next;
}

// MAIN FUNCTION
// export const getNextValues = async (inputValues = []) => {
//     if (!Array.isArray(inputValues)) inputValues = [inputValues];
  
//     const results = {};
//     for (const input of inputValues) {
//       const cleaned = input.trim().toLowerCase();
  
//       // STEP 1 — Find row where this value exists
//       const row = await IssueModel.findOne({
//         $or: columnOrder.map(c => ({
//           [c]: { $regex: new RegExp(`^${cleaned}$`, "i") }
//         }))
//       }).lean();
  
//       if (!row) {
//         results[input] = [];
//         continue;
//       }
  
//       // STEP 2 — Identify which column matched
//       const currentCol = columnOrder.find(
//         c => row[c] && row[c].trim().toLowerCase() === cleaned
//       );
  
//       if (!currentCol) {
//         results[input] = [];
//         continue;
//       }
  
//       // STEP 3 — Next columns
//       const possibleNextCols = columnOrder.slice(
//         columnOrder.indexOf(currentCol) + 1
//       );
  
//       let nextValues = [];
  
//       // STEP 4 — Get next values
//       for (const col of possibleNextCols) {
//         const rows = await IssueModel.find({
//           [currentCol]: { $regex: new RegExp(`^${cleaned}$`, "i") }
//         }).lean();
  
//         for (const r of rows) {
//           if (r[col] && r[col].trim() !== "") {
//             nextValues.push({
//               nextColumn: col,
//               nextValue: r[col]
//             });
//           }
//         }
  
//         if (nextValues.length > 0) break;
//       }
  
//       results[input] = nextValues;
//     }
  
//     return results;
//   };
  


export const getNextValues = async (inputValues = []) => {
    if (!Array.isArray(inputValues)) inputValues = [inputValues];
  
    const results = {};
  
    for (const input of inputValues) {
      const cleaned = input.trim().toLowerCase();
  
      // STEP 1 — Find all rows where this issue exists
      const rows = await IssueModel.find({
        $or: columnOrder.map(c => ({
          [c]: { $regex: new RegExp(`^${cleaned}$`, "i") }
        }))
      }).lean();
  
      if (!rows || rows.length === 0) {
        results[input] = {};
        continue;
      }
  
      // STEP 2 — Collect all subsequent column values, including empty strings
      const aggregated = {};
  
      for (const row of rows) {
        // Find which column matched
        const currentCol = columnOrder.find(
          c => row[c] && row[c].trim().toLowerCase() === cleaned
        );
  
        if (!currentCol) continue;
  
        const startIndex = columnOrder.indexOf(currentCol) + 1;
        const subsequentCols = columnOrder.slice(startIndex);
  
        for (const col of subsequentCols) {
          if (!(col in aggregated)) aggregated[col] = new Set();
          // include even empty strings
          aggregated[col].add(row[col] ? row[col].trim() : "");
        }
      }
  
      // Convert Sets to arrays
      for (const col in aggregated) {
        aggregated[col] = Array.from(aggregated[col]);
      }
  
      results[input] = aggregated;
    }
  
    return results;
  };
  
  