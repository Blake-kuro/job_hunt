export interface SmsSender {
  sendLoginCode(phone: string, code: string): Promise<void>;
}

/** 服务商未定时的开发实现；生产环境拒绝假发送。 */
class DevelopmentSmsSender implements SmsSender {
  async sendLoginCode(phone: string, code: string) {
    if (process.env.NODE_ENV === "production") throw new Error("生产环境尚未配置短信服务商");
    console.info(`[sms:development] ${phone} 登录验证码：${code}`);
  }
}

export const smsSender: SmsSender = new DevelopmentSmsSender();
