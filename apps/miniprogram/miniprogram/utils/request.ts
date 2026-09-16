import { API_BASE_URL } from "../config";

const STORAGE_KEY = "cookieJar";

type Jar = Record<string, string>;

function loadJar(): Jar {
  wx.removeStorageSync("sessionCookie"); // 旧版本单 cookie 存储键
  const raw = wx.getStorageSync(STORAGE_KEY);
  return raw && typeof raw === "object" ? (raw as Jar) : {};
}

function saveJar(jar: Jar) {
  wx.setStorageSync(STORAGE_KEY, jar);
}

/**
 * 后端会同时下发 job_hunt_device 与 job_hunt_session 两个 cookie；
 * wx.request 把多个 Set-Cookie 合并成一个字符串（逗号分隔），这里逐个拆开存进 cookie 罐。
 */
function absorbSetCookie(jar: Jar, raw: string) {
  // 先按 "name=value; attr" 段切，再把 Expires 里的逗号（如 "Wed, 21 Oct"）排除掉
  const parts = raw.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
  for (const part of parts) {
    const [pair, ...attrs] = part.split(";");
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const expired = attrs.some((a) => /max-age=0/i.test(a) || /expires=.*1970/i.test(a));
    if (expired || !value) delete jar[name];
    else jar[name] = value;
  }
}

export function cookieHeader(): string {
  return Object.entries(loadJar())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

export function clearCookies() {
  saveJar({});
}

export function request<T>(path: string, method: string = "GET", data?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}/api${path}`,
      method,
      data,
      header: { "content-type": "application/json", cookie: cookieHeader() },
      success(res: any) {
        const raw = res.header?.["Set-Cookie"] || res.header?.["set-cookie"];
        if (raw) {
          const jar = loadJar();
          absorbSetCookie(jar, String(raw));
          saveJar(jar);
        }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data as T);
        else reject(new Error(res.data?.error?.message || `请求失败 (${res.statusCode})`));
      },
      fail: () => reject(new Error("无法连接服务器，请检查后端地址")),
    });
  });
}
