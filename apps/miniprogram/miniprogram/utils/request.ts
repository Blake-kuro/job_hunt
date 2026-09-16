import { API_BASE_URL } from "../config";

export function request<T>(path: string, method: string = "GET", data?: unknown): Promise<T> {
  const app = getApp();
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}/api${path}`, method, data,
      header: { "content-type": "application/json", cookie: app.globalData.cookie || "" },
      success(res: any) {
        const raw = res.header?.["Set-Cookie"] || res.header?.["set-cookie"];
        if (raw) { const cookie = raw.split(";")[0]; app.globalData.cookie = cookie; wx.setStorageSync("sessionCookie", cookie); }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data as T);
        else reject(new Error(res.data?.error?.message || `请求失败 (${res.statusCode})`));
      },
      fail: () => reject(new Error("无法连接服务器，请检查后端地址")),
    });
  });
}
