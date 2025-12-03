import express from 'express';
import { IssueModel } from '../models/IssueSchema.js';


const router = express.Router();

router.get("/getIssueMapping", async (req, res) => {
    try {
      const { field, ...filters } = req.query;
  
      if (!field) {
        return res.status(400).json({ error: "Missing field parameter" });
      }
  
      const escapeRegex = (str) =>
        str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  
      let mongoFilters = {};
  
      Object.keys(filters).forEach((key) => {
        // decode +, %2B, %252B, etc.
        let decoded = decodeURIComponent(filters[key] || "");
  
        // escape regex special characters (+, *, ?, ., etc)
        decoded = escapeRegex(decoded);
  
        mongoFilters[key] = {
          $regex: decoded,
          $options: "i",
        };
      });
  
      const results = await IssueModel.find(mongoFilters).select(field);
  
      let values = [...new Set(results.map((r) => r[field]))];
  
      res.json({ filters: mongoFilters, field, values, results });
  
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });
  

export default router;
