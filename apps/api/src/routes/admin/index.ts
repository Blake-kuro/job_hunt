import { companyRoutes } from "./companies";
import { contentRoutes } from "./content";
import { courseRoutes } from "./courses";
import { adminGuard, newAdminRouter } from "./guard";
import { jobRoutes } from "./jobs";
import { questionRoutes } from "./questions";
import { studentRoutes } from "./students";
import { summaryRoutes } from "./summary";

export const adminRoutes = newAdminRouter();
adminRoutes.use(adminGuard);
adminRoutes.route("/", summaryRoutes);
adminRoutes.route("/", studentRoutes);
adminRoutes.route("/", contentRoutes);
adminRoutes.route("/", courseRoutes);
adminRoutes.route("/", companyRoutes);
adminRoutes.route("/", questionRoutes);
adminRoutes.route("/", jobRoutes);
