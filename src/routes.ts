import { Router } from "express";
import { enumRoutes } from "./routes/enumRoutes.js";
import { atendimentoRoutes } from "./routes/atendimentoRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { restErrorHandler } from "./routes/routeHelpers.js";

const router = Router();

router.use(enumRoutes);
router.use(atendimentoRoutes);
router.use(authRoutes);

// REST-only error sink — must be last so it catches forwarded handler errors.
router.use(restErrorHandler);

export const RESTAPIRoutes = router;
