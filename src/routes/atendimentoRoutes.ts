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

// The PNAE REST client maps its semantic `foto`/`relatorio` to a concrete stored MIME and probes
// one MIME at a time, so `fileType` here is a `tipo_arquivo` value (e.g. `application/pdf`). Returns
// the lowest-id active match's raw binary as `{ arquivo }`, or `{ arquivo: null }` when there is
// none — a miss is a normal "try the next MIME" signal, so it is a 200, not a 404.
router.get("/getArquivos", async (req: Request, res: Response) => {
  const atendimentoId = routeParam(req.query.atendimentoId as string);
  const tipoArquivo = routeParam(req.query.fileType as string);

  if (!atendimentoId || !tipoArquivo) {
    throw new GraphQLError("atendimentoId e fileType são obrigatórios.", {
      extensions: { code: "BAD_REQUEST" },
    });
  }

  const id = parseAtendimentoId(atendimentoId);
  const arquivo = await atendimentoRepository.getArquivoByTipo(id, tipoArquivo);
  return res.json({ arquivo });
});

// All active files of an atendimento (metadata + raw binary), lowest `idArquivo` first. Consumed
// by the PNAE combined manual-PDF flow, which embeds every relatório PDF and proof photo — the
// single-file `getArquivos` probe above stays untouched for the raw-download path.
router.get("/getArquivosAtendimento", async (req: Request, res: Response) => {
  const atendimentoId = routeParam(req.query.atendimentoId as string);

  if (!atendimentoId) {
    throw new GraphQLError("atendimentoId é obrigatório.", {
      extensions: { code: "BAD_REQUEST" },
    });
  }

  const id = parseAtendimentoId(atendimentoId);
  const arquivos = await atendimentoRepository.getArquivosAtendimento(id);
  return res.json({ arquivos });
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
