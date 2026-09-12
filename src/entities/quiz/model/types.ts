export interface QuizOption {
  letter: "A" | "B" | "C" | "D";
  text: string;
}

export interface QuizQuestionData {
  date: string;
  category: string;
  difficulty: string;
  source: string;
  indexLabel: string;
  prompt: string;
  options: QuizOption[];
  answer: QuizOption["letter"];
  explanation: string[];
  accuracyRate: number;
}

export interface DayCheckin {
  label: string;
  done: boolean;
}

export interface QuizCategory {
  label: string;
  count: number;
  highlighted?: boolean;
}

export interface WrongItem {
  title: string;
  due: string;
}

export interface CompanySet {
  kicker: string;
  company: string;
  focus: string;
  count: number;
}
