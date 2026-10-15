import { Router } from "express";
import { AtendimentosAggregatesValidation } from "../modules/atendimentosCache/AtendimentosAggregatesValidation.js";
import { atendimentosCacheRepository } from "./dependencies.js";

const router = Router();

router.post("/atendimentosCache/aggregates", async (req, res) => {
  const request = AtendimentosAggregatesValidation.parse(req.body);
  const result = await atendimentosCacheRepository.getAggregates(request);
  return res.json(result);
});

export const atendimentosCacheRoutes = router;
