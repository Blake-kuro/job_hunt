import { useState } from "react";
import { useCreateQuestion, usePatchQuestion } from "@api/mutations";
import type { AdminQuestion, AdminQuestionBody, AdminQuizMeta, Difficulty, QuestionType } from "@api/types";
import { Button } from "@shared/ui/Button";
import { Dialog } from "@shared/ui/Dialog";
import { Field } from "@shared/ui/Field";
import { Input } from "@shared/ui/Input";
import { Select } from "@shared/ui/Select";
import { Textarea } from "@shared/ui/Textarea";
import {
  DIFFICULTY_LABEL,
  TYPE_LABEL,
  emptyQuestionForm,
  fromQuestion,
  LETTERS,
  type QuestionFormState,
  toQuestionBody,
} from "./question-form";

const FORM_ID = "question-form";

interface QuestionDialogProps {
  mode: "create" | "edit";
  question: AdminQuestion | null;
  meta: AdminQuizMeta;
  open: boolean;
  onClose: () => void;
}

/** 新增 / 编辑题目：同一个表单，edit 时用 question 预填，保存时整包 body 发 PATCH */
export function QuestionDialog({ mode, question, meta, open, onClose }: QuestionDialogProps) {
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
          key={question?.id ?? "new"}
          question={question}
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
  meta: AdminQuizMeta;
  serverError: string | null;
  onSubmit: (body: AdminQuestionBody) => void;
}

function QuestionForm({ question, meta, serverError, onSubmit }: QuestionFormProps) {
  const [state, setState] = useState<QuestionFormState>(() => (question ? fromQuestion(question) : emptyQuestionForm));
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof QuestionFormState>(key: K, value: QuestionFormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function setOption(index: number, text: string) {
    setState((s) => {
      const options = [...s.options] as QuestionFormState["options"];
      options[index] = text;
      return { ...s, options };
    });
  }

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

      <Field label="分类" htmlFor="question-category">
        <Select id="question-category" value={state.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
          <option value="">请选择分类</option>
          {meta.companies.flatMap((co) =>
            co.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {co.name} / {c.name}
              </option>
            )),
          )}
        </Select>
      </Field>
      <Field label="题型" htmlFor="question-type">
        <Select
          id="question-type"
          value={state.type}
          onChange={(e) => {
            const type = e.target.value as QuestionType;
            setState((s) => ({
              ...s,
              type,
              answer: "A",
              options: type === "JUDGE" ? ["正确", "错误"] : ["", "", "", ""],
            }));
          }}
        >
          {(Object.keys(TYPE_LABEL) as QuestionType[]).map((type) => (
            <option key={type} value={type}>
              {TYPE_LABEL[type]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="章节（可选）" htmlFor="question-section">
        <Input id="question-section" value={state.section} onChange={(e) => set("section", e.target.value)} />
      </Field>
      <Field label="排序" htmlFor="question-order">
        <Input
          id="question-order"
          type="number"
          step="1"
          value={state.sortOrder}
          onChange={(e) => set("sortOrder", Number(e.target.value))}
        />
      </Field>

      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1.5 text-xs font-medium text-neutral-800">选项（勾选正确答案，多选题至少两个）</legend>
        {LETTERS.slice(0, state.options.length).map((letter, i) => (
          <div key={letter} className="flex items-center gap-3">
            <label className="flex w-12 shrink-0 cursor-pointer items-center gap-1.5 text-sm font-medium">
              <input
                type={state.type === "MULTI" ? "checkbox" : "radio"}
                name="question-answer"
                value={letter}
                checked={state.answer.includes(letter)}
                onChange={() =>
                  set(
                    "answer",
                    state.type !== "MULTI"
                      ? letter
                      : state.answer.includes(letter)
                        ? state.answer.replace(letter, "")
                        : [...state.answer, letter].sort().join(""),
                  )
                }
              />
              {letter}
            </label>
            <Input
              aria-label={`选项 ${letter}`}
              value={state.options[i]}
              disabled={state.type === "JUDGE"}
              onChange={(e) => setOption(i, e.target.value)}
            />
          </div>
        ))}
        {state.type !== "JUDGE" && (
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={state.options.length >= 6}
              onClick={() => set("options", [...state.options, ""])}
            >
              添加选项
            </Button>
            <Button
              type="button"
              disabled={state.options.length <= (state.type === "MULTI" ? 3 : 2)}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  options: s.options.slice(0, -1),
                  answer: s.answer.replace(LETTERS[s.options.length - 1], ""),
                }))
              }
            >
              移除末项
            </Button>
          </div>
        )}
      </fieldset>

      <div className="sm:col-span-2">
        <Field label="解析" htmlFor="question-explanation" hint="每行一条">
          <Textarea
            id="question-explanation"
            rows={4}
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
      <Field label="来源" htmlFor="question-source" hint="如「牛客网」「自编」">
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
