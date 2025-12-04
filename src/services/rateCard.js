import RateCard from "../models/RateCard.js";

export const calculateServiceCost = async (tyreType, services = []) => {
  try {
    let totalCost = 0;
    const breakdown = [];

    for (const rawService of services) {
      const cleanService = rawService.replace(/[^a-zA-Z0-9 ]/g, " ").trim();

      // Create relaxed regex for matching
      const regexPattern = cleanService
        .split(" ")
        .filter(Boolean)
        .join(".*");

      const rateCard = await RateCard.findOne({
        tyreService: { $regex: regexPattern, $options: "i" }
      });

      if (rateCard) {
        const cost =
          tyreType.toLowerCase() === "tubeless"
            ? rateCard.tubelessRate || 0
            : rateCard.normalRate || 0;

        totalCost += cost;
        breakdown.push({
          service: rateCard.tyreService,
          cost
        });
      } else {
        breakdown.push({
          service: rawService,
          cost: 0,
          note: "Not found in RateCard"
        });
      }
    }

    return {
      success: true,
      totalCost,
      breakdown
    };

  } catch (err) {
    console.error("Error in calculateServiceCost:", err);
    return {
      success: false,
      totalCost: 0,
      breakdown: [],
      error: "Server Error"
    };
  }
};
