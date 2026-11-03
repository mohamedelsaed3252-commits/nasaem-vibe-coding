import { Router, type IRouter } from "express";
import { requireActiveStaff } from "../middlewares/appAuth";
import authRouter from "./auth";
import backupRouter from "./backup";
import dashboardRouter from "./dashboard";
import healthRouter from "./health";
import localAuthRouter from "./localAuth";
import productsRouter from "./products";
import salesRouter from "./sales";
import suppliesRouter from "./supplies";
import financeRouter from "./finance";
import teamRouter from "./team";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(localAuthRouter);
router.use(requireActiveStaff);
router.use(dashboardRouter);
router.use(productsRouter);
router.use(salesRouter);
router.use(suppliesRouter);
router.use(financeRouter);
router.use(teamRouter);
router.use(backupRouter);

export default router;
