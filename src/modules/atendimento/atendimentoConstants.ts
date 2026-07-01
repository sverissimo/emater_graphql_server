/**
 * `at_atendimento_indicador.id_at_indicador` that tags an atendimento as a hand-made relatório
 * (created outside the PNAE app). Combined with `link_pdf IS NULL` it defines the "relatório manual"
 * set surfaced by `atendimentosComRelatorioManual`. See
 * docs/plans/atendimento-list-read-endpoint-plan.md "The filter".
 */
export const RELATORIO_MANUAL_INDICADOR_ID = 4550n;

/**
 * Sentinel cursor for the first keyset page: one past the max int8 id, so
 * `id_at_atendimento < cursor` is always true and the Step-1 SQL keeps a single static shape (no
 * conditional clause assembly to omit the cursor on page 1).
 */
export const ATENDIMENTO_KEYSET_START_CURSOR = 9223372036854775807n;

/** Page-size bounds for the keyset list. Clamp, never reject — see the plan's pagination contract. */
export const ATENDIMENTO_PAGE_SIZE_DEFAULT = 200;
export const ATENDIMENTO_PAGE_SIZE_MAX = 1000;
