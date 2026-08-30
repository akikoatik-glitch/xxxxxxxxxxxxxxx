import type { Prediction } from "@/types";

export type PredictionType = "pick" | "over25" | "btts";

export function getPredictionType(prediction: Prediction): PredictionType {
  if (prediction.over25 >= 0.62) return "over25";
  if (prediction.btts >= 0.62) return "btts";
  return "pick";
}

export const PREDICTION_TYPE_LABELS: Record<PredictionType, string> = {
  pick: "1X2 picks",
  over25: "Over 2.5 goals",
  btts: "Both teams to score"
};