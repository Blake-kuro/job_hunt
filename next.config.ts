import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// 激活 standalone 输出模式，使构建过程提取精简运行集
	output: "standalone",
};

export default nextConfig;
