import { request, clearCookies } from "../../utils/request";
import type { QuizBanks, QuizDashboard } from "../../api/types";

const TIER_LABEL: Record<string, string> = { GUEST: "游客", FREE: "免费账号", PRO: "PRO" };
const FREE_QUESTIONS = 200;

interface CategoryView {
  id: string;
  name: string;
  total: number;
  answered: number;
  correct: number;
  pct: number;
  label: string;
  disabled: boolean;
}
interface CompanyView {
  id: string;
  name: string;
  categories: CategoryView[];
}

function categoryLabel(c: { total: number; answered: number }): string {
  if (c.total === 0) return "暂无题目";
  if (c.answered === 0) return "开始";
  if (c.answered < c.total) return "继续";
  return "已完成";
}

Page({
  data: {
    dashboard: null as QuizDashboard | null,
    banks: null as QuizBanks | null,
    companies: [] as CompanyView[],
    tier: "GUEST",
    tierLabel: "游客",
    quotaLimit: "不限",
    quotaExhausted: false,
    freeQuestions: FREE_QUESTIONS,
    loading: false,
    error: "",
  },
  onShow() {
    this.load();
  },
  async load() {
    this.setData({ loading: true, error: "" });
    try {
      // 先建立游客会话，再请求另一资源，避免并发创建不同游客。
      const dashboard = await request<QuizDashboard>("/quiz/dashboard");
      const banks = await request<QuizBanks>("/quiz/banks");
      const quota = dashboard.quota ?? { tier: "GUEST", limit: null, used: 0 };
      const companies: CompanyView[] = (banks.companies ?? []).map((co) => ({
        id: co.id,
        name: co.name,
        categories: co.categories.map((c) => ({
          ...c,
          pct: c.total === 0 ? 0 : Math.round((c.answered / c.total) * 100),
          label: categoryLabel(c),
          disabled: c.total === 0,
        })),
      }));
      this.setData({
        dashboard,
        banks,
        companies,
        tier: quota.tier,
        tierLabel: TIER_LABEL[quota.tier] ?? quota.tier,
        quotaLimit: quota.limit === null ? "不限" : String(quota.limit),
        quotaExhausted: quota.limit !== null && quota.used >= quota.limit,
      });
    } catch (e: any) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ loading: false });
    }
  },
  login() {
    wx.navigateTo({ url: "/pages/login/login" });
  },
  async logout() {
    try {
      await request("/auth/logout", "POST");
    } catch {
      // 会话已失效也当作退出成功
    }
    clearCookies();
    this.load();
  },
  start(e: any) {
    const categoryId = e.currentTarget.dataset.categoryId;
    if (categoryId) wx.navigateTo({ url: "/pages/quiz/quiz?categoryId=" + encodeURIComponent(categoryId) });
  },
});
