import { Request, Response, Router } from "express";
import { enumPropsRepository } from "./dependencies.js";

const router = Router();

router.get("/getPerfilOptions", async (_req: Request, res: Response) => {
  const perfilOptions = await enumPropsRepository.getPerfilOptions();
  return res.send(perfilOptions);
});

router.get("/getPerfilOptionsRaw", async (_req: Request, res: Response) => {
  const perfilOptions = await enumPropsRepository.getPerfilOptionsRaw();
  return res.send(perfilOptions);
});

router.get("/getGruposProdutos", async (_req: Request, res: Response) => {
  const gruposProdutos = await enumPropsRepository.getGruposProdutos();
  return res.send(gruposProdutos);
});

router.get("/getContractInfo", async (_req: Request, res: Response) => {
  const contractInfo = await enumPropsRepository.getContractInfo();
  return res.send(contractInfo);
});

router.get("/getRegionaisEmater", async (_req: Request, res: Response) => {
  const regionais = await enumPropsRepository.getRegionaisEmater();
  return res.send(regionais);
});

router.get("/getMunicipiosEmater", async (_req: Request, res: Response) => {
  const municipios = await enumPropsRepository.getMunicipiosEmater();
  return res.send(municipios);
});

export const enumRoutes = router;
