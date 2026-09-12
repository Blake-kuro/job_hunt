import "../load-env";

// 集成测试只接受显式配置的独立测试库，绝不回退到开发库。
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (!url.pathname.endsWith("_test")) throw new Error("TEST_DATABASE_URL 的数据库名必须以 _test 结尾");
}
process.env.DATABASE_URL = testUrl ?? "";
