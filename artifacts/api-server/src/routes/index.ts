import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eventsRouter from "./events";
import logisticsRouter from "./logistics";
import revenueRouter from "./revenue";
import frfRouter from "./frf";
import allocationsRouter from "./allocations";
import attendeesRouter from "./attendees";
import donorsRouter from "./donors";
import donationsRouter from "./donations";
import followupRouter from "./followup";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import importRouter from "./import";
import aiMappingRouter from "./aiMapping";
import aiExtractRouter from "./aiExtract";
import aiCommitRouter from "./aiCommit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventsRouter);
router.use(logisticsRouter);
router.use(revenueRouter);
router.use(frfRouter);
router.use(allocationsRouter);
router.use(attendeesRouter);
router.use(donorsRouter);
router.use(donationsRouter);
router.use(followupRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(importRouter);
router.use(aiMappingRouter);
router.use(aiExtractRouter);
router.use(aiCommitRouter);

export default router;
