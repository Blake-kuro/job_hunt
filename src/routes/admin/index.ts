import { contentRoutes } from "./content";
import { adminGuard, newAdminRouter } from "./guard";
import { questionRoutes } from "./questions";
import { studentRoutes } from "./students";
import { summaryRoutes } from "./summary";

export const adminRoutes = newAdminRouter();
adminRoutes.use(adminGuard);
adminRoutes.route("/", summaryRoutes);
adminRoutes.route("/", studentRoutes);
adminRoutes.route("/", contentRoutes);
adminRoutes.route("/", questionRoutes);
