import { at_atendimento } from "../../../generated/prisma/client.js";

export type UpdateAtendimentoDTO = Partial<at_atendimento> & {
  id_at_atendimento: bigint;
  data_inicio_atendimento: Date | undefined;
};
