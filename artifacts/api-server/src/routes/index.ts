import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import documentsRouter from "./documents";
import researchRouter from "./research";

const router: IRouter = Router();

router.use(healthRouter);
router.use(openaiRouter);
router.use(documentsRouter);
router.use(researchRouter);

export default router;
