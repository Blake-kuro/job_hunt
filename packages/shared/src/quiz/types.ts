import type { QuizOption, QuizOptionLetter } from "./schema";

/** 发给前端的题目：不含答案与解析 */
export interface QuizQuestionPublic {
  id: string;
  prompt: string;
  options: QuizOption[];
  category: string;
  difficulty: string;
  source: string;
}

export interface QuizToday {
  question: QuizQuestionPublic | null;
  indexLabel: string;
  attemptedToday: number;
  date: string; // YYYY-MM-DD
}

export interface QuizAnswerResult {
  correct: boolean;
  answer: QuizOptionLetter;
  explanation: string[];
  accuracyRate: number | null;
}

export interface WrongBookItem {
  questionId: string;
  title: string;
  due: string;
}

export type WeekLabel = "一" | "二" | "三" | "四" | "五" | "六" | "日";

export interface QuizDashboard {
  streakDays: number;
  week: { label: WeekLabel; done: boolean }[];
  weekSolved: number;
  weekTarget: number;
  totalSolved: number;
  categories: { id: string; label: string; count: number }[];
  wrongList: WrongBookItem[];
}

export interface CompanySetItem {
  id: string;
  company: string;
  track: string;
  focus: string;
  count: number;
}
