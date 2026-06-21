import { Request, Response, Router } from "express";
import { GraphQLError } from "graphql";
import { routeParam } from "./routeHelpers.js";
import { atendimentoRepository } from "./dependencies.js";

const router = Router();

// Throws a BAD_REQUEST-coded error (-> 400 via restErrorHandler) for a
// non-numeric id, before any repo call.
function parseAtendimentoId(raw: string): bigint {
  try {
    return BigInt(raw);
  } catch {
    throw new GraphQLError("Id inválido. Verifique o id enviado.", {
      extensions: { code: "BAD_REQUEST" },
    });
  }
}

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

router.patch(
  "/aprovarAtendimento/:atendimentoId",
  async (req: Request, res: Response) => {
    const id = parseAtendimentoId(routeParam(req.params.atendimentoId));
    await atendimentoRepository.setValidacaoStatus(id, true);
    return res.status(204).send();
  },
);

router.patch(
  "/criarPendenciaAtendimento/:atendimentoId",
  async (req: Request, res: Response) => {
    const id = parseAtendimentoId(routeParam(req.params.atendimentoId));
    await atendimentoRepository.setValidacaoStatus(id, false);
    return res.status(204).send();
  },
);

router.patch(
  "/aprovarSei/:atendimentoId",
  async (req: Request, res: Response) => {
    const id = parseAtendimentoId(routeParam(req.params.atendimentoId));
    await atendimentoRepository.setDataSeiStatus(id, true);
    return res.status(204).send();
  },
);

router.patch(
  "/removerAprovacaoSei/:atendimentoId",
  async (req: Request, res: Response) => {
    const id = parseAtendimentoId(routeParam(req.params.atendimentoId));
    await atendimentoRepository.setDataSeiStatus(id, false);
    return res.status(204).send();
  },
);

export const atendimentoRoutes = router;
