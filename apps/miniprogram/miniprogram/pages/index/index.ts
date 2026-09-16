import { request } from "../../utils/request";
import type { QuizBanks, QuizDashboard } from "../../api/types";
Page({
  data: { dashboard: null as QuizDashboard | null, banks: null as QuizBanks | null, loading: false, error: "" },
  onShow() {
    this.load();
  },
  async load() {
    this.setData({ loading: true, error: "" });
    try {
      // 先建立游客会话，再请求另一资源，避免并发创建不同游客。
      const dashboard = await request<QuizDashboard>("/quiz/dashboard");
      const banks = await request<QuizBanks>("/quiz/banks");
      this.setData({ dashboard, banks });
    } catch (e: any) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ loading: false });
    }
  },
  login() {
    wx.navigateTo({ url: "/pages/login/login" });
  },
  start(e: any) {
    const categoryId = e.currentTarget.dataset.categoryId;
    if (categoryId) wx.navigateTo({ url: "/pages/quiz/quiz?categoryId=" + encodeURIComponent(categoryId) });
  },
});
