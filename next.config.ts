import os from "node:os";
import type { NextConfig } from "next";

const effectiveCpus =
  typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
const percentValue = Number.parseInt(process.env.BUILD_CPU_PERCENT ?? "75", 10);
const cpuPercent = Number.isInteger(percentValue) && percentValue >= 1 && percentValue <= 100 ? percentValue : 75;
const jobsValue = Number.parseInt(process.env.BUILD_JOBS ?? "", 10);
const buildCpus =
  Number.isInteger(jobsValue) && jobsValue > 0
    ? Math.min(jobsValue, effectiveCpus)
    : Math.max(1, Math.floor((effectiveCpus * cpuPercent) / 100));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@swc/helpers/esm/**/*"],
  },
  experimental: {
    cpus: buildCpus,
  },
};

export default nextConfig;
