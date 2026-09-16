import { request } from "../../utils/request";

const PHONE = /^1[3-9]\d{9}$/;

Page({
  data: { phone: "", code: "", sent: false, loading: false, error: "", developmentCode: "", countdown: 0 },
  timer: 0 as number,
  onUnload() {
    if (this.timer) clearInterval(this.timer);
  },
  onPhone(e: any) {
    this.setData({ phone: String(e.detail.value).replace(/\D/g, "") });
  },
  onCode(e: any) {
    this.setData({ code: String(e.detail.value).replace(/\D/g, "") });
  },
  startCountdown(seconds: number) {
    if (this.timer) clearInterval(this.timer);
    this.setData({ countdown: seconds });
    this.timer = setInterval(() => {
      const next = Math.max(0, this.data.countdown - 1);
      this.setData({ countdown: next });
      if (next === 0 && this.timer) clearInterval(this.timer);
    }, 1000) as unknown as number;
  },
  async sendCode() {
    if (this.data.countdown > 0 || this.data.loading) return;
    if (!PHONE.test(this.data.phone)) {
      this.setData({ error: "请输入有效的 11 位大陆手机号" });
      return;
    }
    this.setData({ loading: true, error: "" });
    try {
      const r = await request<{ retryAfter: number; developmentCode?: string }>("/auth/sms/send", "POST", {
        phone: this.data.phone,
      });
      this.setData({ sent: true, developmentCode: r.developmentCode || "", code: r.developmentCode || "" });
      this.startCountdown(r.retryAfter);
    } catch (e: any) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ loading: false });
    }
  },
  async submit() {
    if (!this.data.sent) {
      await this.sendCode();
      return;
    }
    if (!/^\d{6}$/.test(this.data.code)) {
      this.setData({ error: "请输入 6 位验证码" });
      return;
    }
    this.setData({ loading: true, error: "" });
    try {
      await request("/auth/sms/verify", "POST", { phone: this.data.phone, code: this.data.code });
      wx.switchTab({ url: "/pages/index/index" });
    } catch (e: any) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ loading: false });
    }
  },
});
