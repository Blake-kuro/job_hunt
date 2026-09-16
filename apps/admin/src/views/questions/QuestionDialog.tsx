import { useState } from "react";
import { useCreateQuestion, usePatchQuestion } from "@api/mutations";
import type {
  AdminQuestion,
  AdminQuestionBody,
  AdminQuizMeta,
  Difficulty,
  QuestionType,
  QuizOptionLetter,
} from "@api/types";
import { Button } from "@shared/ui/Button";
import { Dialog } from "@shared/ui/Dialog";
import { Field } from "@shared/ui/Field";
import { Input } from "@shared/ui/Input";
import { Select } from "@shared/ui/Select";
import { Textarea } from "@shared/ui/Textarea";
import {
  DIFFICULTY_LABEL,
  emptyQuestionForm,
  fromQuestion,
  LETTERS,
  MAX_OPTIONS,
  MIN_OPTIONS,
  type QuestionFormState,
  setType,
  toQuestionBody,
  TYPE_LABEL,
} from "./question-form";

const FORM_ID = "question-form";

interface QuestionDialogProps {
  mode: "create" | "edit";
  question: AdminQuestion | null;
  /** 新建时默认选中的分类（当前树上选中的） */
  defaultCategoryId?: string;
  meta: AdminQuizMeta;
  open: boolean;
  onClose: () => void;
}

/** 新增 / 编辑题目：同一个表单，edit 时用 question 预填，保存时整包 body 发 PATCH */
export function QuestionDialog({ mode, question, defaultCategoryId, meta, open, onClose }: QuestionDialogProps) {
  const create = useCreateQuestion();
  const patch = usePatchQuestion();
  const pending = create.isPending || patch.isPending;
  const serverError = (mode === "create" ? create.error : patch.error)?.message ?? null;

  function close() {
    create.reset();
    patch.reset();
    onClose();
  }

  function save(body: AdminQuestionBody) {
    if (mode === "edit") {
      if (!question) return;
      patch.mutate({ id: question.id, body }, { onSuccess: close });
    } else {
      create.mutate(body, { onSuccess: close });
    }
  }

  return (
    <Dialog
      open={open}
      wide
      title={mode === "create" ? "新增题目" : "编辑题目"}
      onClose={close}
      footer={
        <>
          <Button type="button" onClick={close}>
            取消
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={pending}>
            {pending ? "保存中…" : "保存"}
          </Button>
        </>
      }
    >
      {open && (mode === "create" || question) && (
        <QuestionForm
          key={question?.id ?? `new-${defaultCategoryId ?? ""}`}
          question={question}
          defaultCategoryId={defaultCategoryId}
          meta={meta}
          serverError={serverError}
          onSubmit={save}
        />
      )}
    </Dialog>
  );
}

interface QuestionFormProps {
  question: AdminQuestion | null;
  defaultCategoryId?: string;
  meta: AdminQuizMeta;
  serverError: string | null;
  onSubmit: (body: AdminQuestionBody) => void;
}

function QuestionForm({ question, defaultCategoryId, meta, serverError, onSubmit }: QuestionFormProps) {
  const [state, setState] = useState<QuestionFormState>(() =>
    question ? fromQuestion(question) : { ...emptyQuestionForm, categoryId: defaultCategoryId ?? "" },
  );
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof QuestionFormState>(key: K, value: QuestionFormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function setOption(index: number, text: string) {
    setState((s) => ({ ...s, options: s.options.map((t, i) => (i === index ? text : t)) }));
  }

  function addOption() {
    setState((s) => (s.options.length >= MAX_OPTIONS ? s : { ...s, options: [...s.options, ""] }));
  }

  /** 删掉一行后字母重新排：被删行的答案去掉，其后的答案往前挪一位 */
  function removeOption(index: number) {
    setState((s) => {
      if (s.options.length <= MIN_OPTIONS) return s;
      const answer = s.answer
        .map((l) => LETTERS.indexOf(l))
        .filter((i) => i !== index)
        .map((i) => LETTERS[i > index ? i - 1 : i]);
      return { ...s, options: s.options.filter((_, i) => i !== index), answer };
    });
  }

  function pick(letter: QuizOptionLetter) {
    setState((s) => {
      if (s.type !== "MULTI") return { ...s, answer: [letter] };
      const answer = s.answer.includes(letter) ? s.answer.filter((l) => l !== letter) : [...s.answer, letter];
      return { ...s, answer };
    });
  }

  const isJudge = state.type === "JUDGE";
  const isMulti = state.type === "MULTI";

  return (
    <form
      id={FORM_ID}
      className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const result = toQuestionBody(state);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        onSubmit(result.body);
      }}
    >
      <Field label="分类" htmlFor="question-category">
        <Select id="question-category" value={state.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
          <option value="">请选择分类</option>
          {meta.companies.flatMap((co) =>
            co.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {co.name} · {c.name}
              </option>
            )),
          )}
        </Select>
      </Field>
      <Field label="题型" htmlFor="question-type">
        <Select
          id="question-type"
          value={state.type}
          onChange={(e) => setState((s) => setType(s, e.target.value as QuestionType))}
        >
          {(Object.keys(TYPE_LABEL) as QuestionType[]).map((type) => (
            <option key={type} value={type}>
              {TYPE_LABEL[type]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="所属部分" htmlFor="question-section" hint="可选，如「形势政策」「企业文化」">
        <Input
          id="question-section"
          maxLength={50}
          value={state.section}
          onChange={(e) => set("section", e.target.value)}
        />
      </Field>
      <Field label="序号" htmlFor="question-order" hint="分类内的顺序，留空由系统排在最后">
        <Input
          id="question-order"
          type="number"
          step="1"
          inputMode="numeric"
          value={state.sortOrder}
          onChange={(e) => set("sortOrder", e.target.value)}
        />
      </Field>

      <div className="sm:col-span-2">
        <Field label="题干" htmlFor="question-prompt">
          <Textarea
            id="question-prompt"
            rows={3}
            value={state.prompt}
            onChange={(e) => set("prompt", e.target.value)}
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1.5 text-xs font-medium text-neutral-800">
          选项
          <span className="ml-2 font-normal text-neutral-600">
            {isJudge
              ? "判断题选项固定，选出正确答案即可"
              : isMulti
                ? "勾选所有正确答案（至少两个）"
                : "选出唯一正确答案"}
          </span>
        </legend>
        {state.options.map((text, i) => {
          const letter = LETTERS[i];
          return (
            <div key={letter} className="flex items-center gap-3">
              <label className="flex w-12 shrink-0 cursor-pointer items-center gap-1.5 text-sm font-medium">
                <input
                  type={isMulti ? "checkbox" : "radio"}
                  name="question-answer"
                  value={letter}
                  checked={state.answer.includes(letter)}
                  onChange={() => pick(letter)}
                />
                {letter}
              </label>
              <Input
                aria-label={`选项 ${letter}`}
                value={text}
                readOnly={isJudge}
                className={isJudge ? "bg-bg text-neutral-700" : undefined}
                onChange={(e) => setOption(i, e.target.value)}
              />
              {!isJudge && (
                <Button
                  type="button"
                  size="sm"
                  aria-label={`删除选项 ${letter}`}
                  disabled={state.options.length <= MIN_OPTIONS}
                  onClick={() => removeOption(i)}
                >
                  删除
                </Button>
              )}
            </div>
          );
        })}
        {!isJudge && (
          <div>
            <Button type="button" size="sm" disabled={state.options.length >= MAX_OPTIONS} onClick={addOption}>
              添加选项
            </Button>
          </div>
        )}
      </fieldset>

      <div className="sm:col-span-2">
        <Field label="解析" htmlFor="question-explanation" hint="每行一条，可留空">
          <Textarea
            id="question-explanation"
            rows={3}
            value={state.explanation}
            onChange={(e) => set("explanation", e.target.value)}
          />
        </Field>
      </div>

      <Field label="难度" htmlFor="question-difficulty">
        <Select
          id="question-difficulty"
          value={state.difficulty}
          onChange={(e) => set("difficulty", e.target.value as Difficulty)}
        >
          {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="来源" htmlFor="question-source" hint="如「中国华电 · 公共与行业知识」「自编」">
        <Input id="question-source" value={state.source} onChange={(e) => set("source", e.target.value)} />
      </Field>

      <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={state.published} onChange={(e) => set("published", e.target.checked)} />
        已发布（学生端可见）
      </label>

      {(error || serverError) && (
        <p role="alert" className="text-xs text-red-700 sm:col-span-2">
          {error ?? `保存失败：${serverError}`}
        </p>
      )}
    </form>
  );
}
