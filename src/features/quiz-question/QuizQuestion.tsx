"use client";

import { useState } from "react";
import { Button } from "@shared/ui/Button";
import { Tag } from "@shared/ui/Tag";
import { Kicker } from "@shared/ui/Kicker";
import { cn } from "@shared/lib/cn";
import type { QuizOption, QuizQuestionData } from "@entities/quiz";

interface QuizQuestionProps {
  question: QuizQuestionData;
}

type OptionState = "idle" | "picked" | "right" | "wrong";

function optionState(
  option: QuizOption,
  picked: string | null,
  revealed: boolean,
  answer: string,
): OptionState {
  const isPicked = picked === option.letter;
  if (revealed && option.letter === answer) return "right";
  if (revealed && isPicked) return "wrong";
  if (isPicked) return "picked";
  return "idle";
}

const rowClass: Record<OptionState, string> = {
  idle: "border-divider hover:border-accent-400",
  picked: "border-accent-600 bg-accent-100",
  right: "border-accent bg-accent-100",
  wrong: "border-neutral-400 bg-neutral-100 text-neutral-600",
};

const badgeClass: Record<OptionState, string> = {
  idle: "border-divider text-neutral-700",
  picked: "border-accent bg-accent text-bg",
  right: "border-accent bg-accent text-bg",
  wrong: "border-neutral-400 text-neutral-600",
};

const markText: Record<OptionState, string> = {
  idle: "",
  picked: "已选",
  right: "正确答案",
  wrong: "你的选择",
};

export function QuizQuestion({ question }: QuizQuestionProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const correct = picked === question.answer;

  return (
    <div className="px-4 py-8 sm:px-8 sm:py-9">
      <div className="flex flex-wrap items-center gap-2.5">
        <Kicker className="text-accent-700">今日一题 · {question.date}</Kicker>
        <Tag>{question.category}</Tag>
        <Tag>{question.difficulty}</Tag>
        <Tag variant="outline">{question.source}</Tag>
        <span className="text-xs tabular-nums text-neutral-700">{question.indexLabel}</span>
      </div>

      <h2 className="mt-3 max-w-[820px] text-[22px] leading-snug sm:text-[26px] lg:text-[30px]">
        {question.prompt}
      </h2>

      <div className="mt-5 flex max-w-[880px] flex-col gap-2.5">
        {question.options.map((option) => {
          const state = optionState(option, picked, revealed, question.answer);
          return (
            <button
              key={option.letter}
              type="button"
              aria-pressed={picked === option.letter}
              onClick={() => setPicked(option.letter)}
              className={cn(
                "grid cursor-pointer grid-cols-[26px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 border px-4 py-3 text-left transition-colors sm:grid-cols-[26px_minmax(0,1fr)_auto]",
                rowClass[state],
              )}
            >
              <span
                className={cn(
                  "flex size-[26px] items-center justify-center border font-heading text-sm tabular-nums",
                  badgeClass[state],
                )}
              >
                {option.letter}
              </span>
              <span className="text-[15px] leading-relaxed">{option.text}</span>
              {markText[state] && (
                <span
                  className={cn(
                    "col-start-2 whitespace-nowrap text-xs sm:col-start-3",
                    state === "wrong" ? "text-neutral-600" : "text-accent-700",
                  )}
                >
                  {markText[state]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Button variant="primary" size="lg" blueprint className="px-5" onClick={() => setRevealed((r) => !r)}>
          {revealed ? "收起解析" : "提交并查看答案"}
        </Button>
        <Button size="lg">加入错题本</Button>
        <Button size="lg">标记已掌握</Button>
        <Button variant="ghost" size="lg">下一题 →</Button>
        <div className="hidden flex-1 sm:block" />
        <span className="text-xs tabular-nums text-neutral-700">{picked ? `已选 ${picked}` : "未作答"}</span>
      </div>

      {revealed && (
        <div className="mt-6 max-w-[880px] border-t border-divider pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <Kicker className="text-accent-700">答案 {question.answer}</Kicker>
            <Tag variant={correct ? "accent" : "neutral"}>
              {picked ? (correct ? "回答正确" : "回答错误 · 已加入错题本") : "未作答"}
            </Tag>
            <span className="text-xs tabular-nums text-neutral-700">本题正确率 {question.accuracyRate}%</span>
          </div>
          {question.explanation.map((p, i) => (
            <p key={i} className={cn("text-sm leading-[1.8] text-neutral-800", i === 0 ? "mt-3" : "mt-2.5")}>
              {p}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
