import type { QuestionOutcome } from "./diagnostic-types";
import {
  inferOverallLevel,
  masteryPercentFromResults,
  recommendedStartLevel,
} from "./diagnostic-types";

export interface ClientReport {
  overall_level: "L1" | "L2" | "L3";
  mastery_score: number;
  strong_topics: { topic: string; evidence: string }[];
  weak_topics: { topic: string; gap: string; topic_tag?: string }[];
  recommended_start_level: "L1" | "L2" | "L3";
  student_summary: string;
  /** Prompt A 內部備註，可不展示給學生 */
  teacher_note?: string;
}

function summaryLines(mastery: number): string {
  if (mastery >= 85) {
    return `你在向量核心概念上已有不錯的整合度，看得出來平常有認真思考。接下來不妨多挑戰幾何意義與綜合題，把直覺磨得更穩。`;
  }
  if (mastery >= 55) {
    return `你已有部分知識點相當穩固，同時也有幾個環節特別值得放慢、補強。接下來我們會從你最有感的難度開始，一步一步把缺口補起來。`;
  }
  return `目前基礎步驟還在建立中，這很正常——向量本來就需要一點時間和題目「變熟」。我們會從最關鍵的定義與運算開始，讓你每一步都踩得踏實。`;
}

export function buildClientReport(results: QuestionOutcome[]): ClientReport {
  const mastery_score = masteryPercentFromResults(results);
  const overall_level = inferOverallLevel(mastery_score, results);
  const recommended_start_level = recommendedStartLevel(overall_level, mastery_score);

  const strong_topics = results
    .filter((r) => r.correct)
    .map((r) => ({
      topic: r.topic,
      evidence: `第 ${r.q} 題作答正確，顯示此觀念已有一定掌握。`,
    }));

  const weak_topics = results
    .filter((r) => !r.correct)
    .map((r) => ({
      topic: r.topic,
      topic_tag: r.topicTag,
      gap: `第 ${r.q} 題未達標，建議回到定義與典型例題再練習一次。`,
    }));

  const student_summary = summaryLines(mastery_score);

  return {
    overall_level,
    mastery_score,
    strong_topics,
    weak_topics,
    recommended_start_level,
    student_summary,
  };
}
