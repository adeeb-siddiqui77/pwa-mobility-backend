import mongoose from "mongoose";

const IssueSchema = new mongoose.Schema({
  issue: { type: String, default: "" },
  tyreType: { type: String, default: "" },
  approach: { type: String, default: "" },
  patch: { type: String, default: "" },
  finalService: { type: String, default: "" }
}, { collection: "issue_mappings" });

export const IssueModel = mongoose.model("IssueMapping", IssueSchema);
