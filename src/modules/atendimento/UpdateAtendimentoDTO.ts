import { at_atendimento } from "@prisma/client";

export type UpdateAtendimentoDTO = Partial<at_atendimento> & {
  id_at_atendimento: bigint;
  data_inicio_atendimento: Date | undefined;
};
