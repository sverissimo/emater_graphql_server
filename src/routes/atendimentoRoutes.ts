import { Request, Response, Router } from "express";
import { routeParam } from "./routeHelpers.js";
import { atendimentoRepository } from "./dependencies.js";

const router = Router();

router.get(
  "/getReadOnlyRelatorios/:ids",
  async (req: Request, res: Response) => {
    const ids = routeParam(req.params.ids);
    const readOnlyIds = await atendimentoRepository.getReadOnlyRelatorioIds(
      ids.split(","),
    );
    return res.send(readOnlyIds);
  },
);

router.get("/getReplacedAtendimentos", async (_req: Request, res: Response) => {
  const replacedAtendimentos =
    await atendimentoRepository.getReplacedAtendimentos();
  return res.send(replacedAtendimentos);
});

router.patch(
  "/updateTemasAndVisitaAtendimento/:atendimentoId",
  async (req: Request, res: Response) => {
    const atendimentoId = routeParam(req.params.atendimentoId);
    const { temasAtendimento, numeroVisita } = req.body;
    await atendimentoRepository.updateTemasAndNumeroVisita({
      idAtendimento: BigInt(atendimentoId),
      temasAtendimento,
      numeroVisita,
    });
    return res.status(204).send();
  },
);

export const atendimentoRoutes = router;
