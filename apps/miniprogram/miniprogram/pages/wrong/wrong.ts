import { request } from "../../utils/request";

interface WrongItem {
  questionId: string;
  title: string;
  due: string;
}

Page({
  data: { items: [] as WrongItem[], loading: true, saving: "", error: "" },
  onShow() {
    this.load();
  },
  async load() {
    this.setData({ loading: true });
    try {
      const r = await request<{ items: WrongItem[] }>("/quiz/wrong-book");
      this.setData({ items: r.items, error: "" });
    } catch (e: any) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ loading: false });
    }
  },
  async master(e: any) {
    const id = e.currentTarget.dataset.id as string;
    if (this.data.saving) return;
    this.setData({ saving: id, error: "" });
    try {
      await request(`/quiz/wrong-book/${encodeURIComponent(id)}`, "PUT", { mastered: true });
      wx.showToast({ title: "已掌握", icon: "success" });
      await this.load();
    } catch (e: any) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ saving: "" });
    }
  },
});
