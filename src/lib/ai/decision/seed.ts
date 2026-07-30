import { registerModule } from "@/lib/ai/moduleRegistry";

/** Register the "decision" module so the Copilot/BI know predictions & risks exist. */
let registered = false;
export async function registerDecisionModule() {
  if (registered) return;
  registered = true;
  await registerModule(null, {
    moduleKey: "decision",
    name: "Decision Intelligence",
    description: "Predictions, forecasts, business health, risks, opportunities, scenario simulation and recommendations across every module.",
    menu: "/intelligence/decision",
    businessTerms: ["predict", "forecast", "projection", "risk", "opportunity", "scenario", "simulate", "health score", "recommendation", "what if", "outlook", "trend"],
    kpis: ["Business Health", "Revenue Forecast", "Risk Score", "Prediction Accuracy"],
    questions: ["Predict next month sales", "What are my business risks?", "Forecast cash flow for 90 days", "What opportunities do I have?", "Simulate a 10% sales increase"],
    actions: ["Forecast a metric", "Detect risks", "Simulate a scenario", "View recommendations"],
    permissions: ["intelligence.decision"],
    tables: ["AiPrediction", "AiDecision", "AiScenario"],
    relationships: ["Finance", "Sales", "Inventory", "Customer", "Supplier"],
    enabled: true,
  }).catch(() => {});
}
