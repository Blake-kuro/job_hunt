import "../load-env";

// 测试一律不碰真实腾讯云 VOD：签名 / 媒体信息走 mock
process.env.VOD_MOCK ??= "1";

// 集成测试只接受显式配置的独立测试库，绝不回退到开发库。
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (!url.pathname.endsWith("_test")) throw new Error("TEST_DATABASE_URL 的数据库名必须以 _test 结尾");
}
process.env.DATABASE_URL = testUrl ?? "";
