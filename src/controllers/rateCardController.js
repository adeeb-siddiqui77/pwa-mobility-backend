import RateCard from '../models/RateCard.js';


export const calculateWorkCost = async (req, res) => {
  try {
    console.log("Request Body:", req.body); // Debug log
    const { workDetails } = req.body;
    console.log("Work Details:", workDetails); // Debug log

    if (!workDetails) {
      return res.status(400).json({ error: "workDetails is required" });
    }

    let totalCost = 0;
    const breakdown = [];

    // Iterate over services
    for (const service of workDetails.services || []) {
      console.log("Processing service:", service); // Debug log
      const rateCard = await RateCard.findOne({
        tyreService: { $regex: service, $options: "i" }, // partial + case-insensitive
      });

      if (rateCard) {
        const cost =
          workDetails.tyreType === "tubeless"
            ? rateCard.tubelessRate || 0
            : rateCard.normalRate || 0;

        totalCost += cost;
        breakdown.push({ service, cost });
      } else {
        breakdown.push({ service, cost: 0, note: "Not found in RateCard" });
      }
    }

    // Handle otherServices if needed
    if (workDetails.otherServices) {
      const otherRateCard = await RateCard.findOne({
        tyreService: { $regex: workDetails.otherServices, $options: "i" },
      });

      if (otherRateCard) {
        const cost =
          workDetails.tyreType === "tubeless"
            ? otherRateCard.tubelessRate || 0
            : otherRateCard.normalRate || 0;

        totalCost += cost;
        breakdown.push({ service: workDetails.otherServices, cost });
      } else {
        breakdown.push({
          service: workDetails.otherServices,
          cost: 0,
          note: "Not found in RateCard",
        });
      }
    }

    return res.json({ success: true, totalCost, breakdown });
  } catch (error) {
    console.error("❌ Error calculating work cost:", error);
    return res.status(500).json({ error: "Server error" });
  }
};


