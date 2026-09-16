import { request } from "../../utils/request";
import type { QuizNext, QuizAnswerResult, Letter } from "../../api/types";
Page({
  data: {
    categoryId: "",
    today: null as QuizNext | null,
    picked: [] as Letter[],
    options: [] as { letter: Letter; text: string; selected: boolean; right: boolean; wrong: boolean }[],
    result: null as QuizAnswerResult | null,
    answerText: "",
    loading: true,
    submitting: false,
    error: "",
  },
  onLoad(query: { categoryId?: string }) {
    this.setData({ categoryId: query.categoryId ?? "" });
    this.load();
  },
  async load() {
    if (this.data.submitting) return;
    if (!this.data.categoryId) {
      this.setData({ loading: false, error: "请从首页选择公司和分类" });
      return;
    }
    this.setData({ loading: true, picked: [], result: null, today: null, options: [], error: "" });
    try {
      const today = await request<QuizNext>("/quiz/categories/" + encodeURIComponent(this.data.categoryId) + "/next");
      this.setData({
        today,
        options: (today.question?.options ?? []).map((o) => ({ ...o, selected: false, right: false, wrong: false })),
      });
    } catch (e: any) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ loading: false });
    }
  },
  pick(e: any) {
    if (this.data.result || this.data.submitting || this.data.loading) return;
    const letter = e.currentTarget.dataset.letter as Letter;
    if (!this.data.options.some((o) => o.letter === letter)) return;
    const old = this.data.picked;
    const picked: Letter[] =
      this.data.today?.question?.type !== "MULTI"
        ? [letter]
        : old.includes(letter)
          ? old.filter((l) => l !== letter)
          : [...old, letter].sort();
    this.setData({ picked, options: this.data.options.map((o) => ({ ...o, selected: picked.includes(o.letter) })) });
  },
  async submit() {
    const question = this.data.today?.question;
    if (!question || !this.data.picked.length || this.data.submitting || this.data.result) return;
    this.setData({ submitting: true, error: "" });
    try {
      const result = await request<QuizAnswerResult>("/quiz/attempts", "POST", {
        questionId: question.id,
        picked: this.data.picked,
      });
      this.setData({
        result,
        answerText: result.answer.join("、"),
        options: this.data.options.map((o) => ({
          ...o,
          right: result.answer.includes(o.letter),
          wrong: o.selected && !result.answer.includes(o.letter),
        })),
      });
    } catch (e: any) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ submitting: false });
    }
  },
  next() {
    this.load();
  },
  back() {
    wx.switchTab({ url: "/pages/index/index" });
  },
});
