# Task: gestão exploration endpoints for programa codes

Two temporary exploration endpoints. They show how many active atendimentos each **active** programa code has, so the author can choose 5–10 programas for the monthly reports in [the phase 1 caching plan](caching-plan-phase-1.md).

| Endpoint | Body | Returns |
| --- | --- | --- |
| `POST /api/gestao/contagemPorPrograma` | codes to **exclude** | Counts and dates for every active code not excluded. No atendimento rows. |
| `POST /api/gestao/atendimentosPorPrograma` | codes to **include**, at most 20 | Counts, dates, and atendimento rows for those codes. |

Intended workflow:

1. Call the counts endpoint, excluding the codes already known to be large (about 200k atendimentos each).
2. Request rows for the chosen codes.

This task is not part of the phase 1 cache. Do not wire any consumer app to these routes.

**This is temporary code, run only in dev, and has no test coverage.** For these runs, the author will temporarily point dev at the prod Demeter database, then call the endpoints manually from Postman. The code may be deleted afterwards.

A programa code is an `at_grupo_indicador.id_at_grupo_indicador`. **Only codes with `at_grupo_indicador.ativo = true` are considered.** [docs/data/codigoProgramas.json](../data/codigoProgramas.json) lists 271 codes; only its 59 active ones are in scope, and the other 212 are ignored.

## Cost

- **Every call has the same minimum cost.** `at_atendimento_indicador` (about 7.8M rows, as reported by the author) has only the index `(id_at_atendimento, id_at_indicador)`. Its leading column is not the indicator, so finding the atendimentos of any set of codes means scanning the whole table once. This happens whether a call names one code or all of them.
- **One call per set of codes, never a loop.** Looping code by code repeats that scan for every code. Each endpoint below does a single scan per call.
- **Excluding large codes helps, but only partly.** It shrinks the work after the scan: the join to `at_atendimento`, removing duplicates, and grouping. The single table scan remains, so the call gets faster but not proportionally faster (an estimate, not measured).
- **Rows make responses large.** A code with about 200k atendimentos returns about 200k rows, a response of tens of MB. Check counts first, and request rows for large codes only if they are really needed.

## Rules shared by both endpoints

### Input and errors

- **Code lists.** Each array may contain digit strings or integers.
  - Remove duplicates.
  - Reject any value that is not all digits.
  - Convert each to `BigInt` in the route, following the AGENTS.md boundary rule.
- **Errors.** Invalid input throws a `GraphQLError` with code `BAD_REQUEST`. The existing `restErrorHandler` turns it into HTTP 400.
- **Auth.** The existing service-token middleware applies. No auth change is needed.

### What gets counted

- **The count.** `atendimentosTotalCount` is the number of distinct atendimentos with `at_atendimento.ativo = true` that link to the code through `at_atendimento_indicador` → `at_indicador`.
- **One indicator or several.** An atendimento with two indicators from the same code counts once.
- **Several codes.** An atendimento linked to two codes counts under both.
- **Active codes only.** Filter on `at_grupo_indicador.ativo = true`. Do not filter on `at_indicador.ativo`.
- **No date filter.** The counts cover the whole history; `minDate` and `maxDate` show its span.

### Output

- **Summary objects.** Both endpoints return an array of summary objects, ordered by `atendimentosTotalCount`, highest first.
- **Codes with no active atendimentos** return a count of `0` and `null` dates.
- **Dates.** Every date is a `dd-mm-yyyy` string, formatted in SQL with `to_char`. No value passes through a JS `Date`, so timezones cannot shift a date.
- **IDs and counts.** SQL casts them to `text` and `int`, so no code path handles a `BigInt`.
- **Field names.** Both endpoints use the same summary field names.
- **Examples.** Counts and dates in the examples below are made up for illustration.

## Endpoint 1: `POST /api/gestao/contagemPorPrograma`

**Request:**

```json
{ "excluirCodigos": ["50", "318"] }
```

`excluirCodigos` is optional. When it is absent or `[]`, the endpoint returns every active code.

**Response:**

```json
[
  {
    "codigoPrograma": "323",
    "programa": "Contrato Nº 9451439/2025-2026 - SEE - ATER no âmbito do PNAE",
    "atendimentosTotalCount": 41210,
    "minDate": "02-01-2025",
    "maxDate": "10-10-2026"
  }
]
```

The response has one object per active code not excluded. An excluded code that does not exist is simply ignored.

## Endpoint 2: `POST /api/gestao/atendimentosPorPrograma`

**Request:**

```json
{ "codigos": ["50", "318"] }
```

`codigos` is required: a non-empty array of at most **20** codes.

**Response:**

```json
[
  {
    "codigoPrograma": "50",
    "programa": "PROGRAMA - MINAS PECUÁRIA",
    "atendimentosTotalCount": 2034,
    "minDate": "13-01-2019",
    "maxDate": "10-10-2026",
    "atendimentos": [
      {
        "id": "1746156",
        "descricao": null,
        "data_inicio_atendimento": "10-10-2026",
        "id_und_empresa": "H0349",
        "orientacao_tecnica": "...",
        "login_usuario": "...",
        "fk_und_empresa": null
      }
    ]
  }
]
```

- **Missing codes.** A requested code that is inactive or does not exist is left out of the response.
- **Empty codes.** A code with no active atendimentos gets `atendimentos: []`.
- **Row content.** An atendimento appears once per code, sorted newest first.
- **Field name.** The original request said "orientacao"; the column is `orientacao_tecnica`.

## SQL

Both endpoints share two fragments. Put each in a private method that returns `Prisma.Sql`.

**The code filter** differs per endpoint:

- **Endpoint 1:** `AND g.id_at_grupo_indicador NOT IN (${Prisma.join(excluir)})`. When the exclusion list is empty, use `Prisma.empty`; `Prisma.join([])` throws.
- **Endpoint 2:** `AND g.id_at_grupo_indicador IN (${Prisma.join(codigos)})`.

**The `gi` subquery** returns distinct (code, atendimento) pairs for active codes that pass the filter:

```sql
SELECT DISTINCT i.id_at_grupo_indicador, ai.id_at_atendimento
FROM at_atendimento_indicador ai
JOIN at_indicador i ON i.id_at_indicador = ai.id_at_indicador
JOIN at_grupo_indicador g ON g.id_at_grupo_indicador = i.id_at_grupo_indicador
WHERE g.ativo = true <filter>
```

**Summary:** endpoint 1 only.

```sql
SELECT g.id_at_grupo_indicador::text AS "codigoPrograma",
       g.descricao AS "programa",
       COUNT(a.id_at_atendimento)::int AS "atendimentosTotalCount",
       to_char(MIN(a.data_inicio_atendimento), 'DD-MM-YYYY') AS "minDate",
       to_char(MAX(a.data_inicio_atendimento), 'DD-MM-YYYY') AS "maxDate"
FROM at_grupo_indicador g
LEFT JOIN (<gi>) gi ON gi.id_at_grupo_indicador = g.id_at_grupo_indicador
LEFT JOIN at_atendimento a
  ON a.id_at_atendimento = gi.id_at_atendimento AND a.ativo = true
WHERE g.ativo = true <filter>
GROUP BY g.id_at_grupo_indicador, g.descricao
ORDER BY "atendimentosTotalCount" DESC;
```

**Rows:** endpoint 2 only. Endpoint 2 derives its summary from these rows: the count is the number of rows, and the dates come from the first and last row. A cheap lookup on `at_grupo_indicador` supplies names and zero-count codes, so each call scans `at_atendimento_indicador` only once.

```sql
SELECT gi.id_at_grupo_indicador::text AS "codigoPrograma",
       a.id_at_atendimento::text AS id,
       a.descricao,
       to_char(a.data_inicio_atendimento, 'DD-MM-YYYY') AS data_inicio_atendimento,
       a.id_und_empresa,
       a.orientacao_tecnica,
       a.login_usuario,
       a.fk_und_empresa
FROM (<gi>) gi
JOIN at_atendimento a ON a.id_at_atendimento = gi.id_at_atendimento
WHERE a.ativo = true
ORDER BY gi.id_at_grupo_indicador, a.data_inicio_atendimento DESC, a.id_at_atendimento DESC;
```

## Files

1. **`src/modules/gestao/repository/GestaoRepository.ts`** (new). It extends `PrismaRepository`. It has the two private fragment methods and a private summary method, plus two public methods:
   - `getContagemPorPrograma(excluirCodigos: bigint[])` runs the summary query only.
   - `getAtendimentosPorPrograma(codigos: bigint[])` runs a name lookup on `at_grupo_indicador` and the rows query. It groups the rows by `codigoPrograma` in a `Map` and derives each count and date span from them.

   The result types stay in this file while only this file uses them. Move them to `src/modules/gestao/types/` if another file starts importing them.
2. **`src/routes/gestaoRoutes.ts`** (new). It defines two `router.post` handlers, one per endpoint. Each handler validates its body, calls the repository, and returns `res.json(result)`. One small local helper parses a code array for both handlers. The handlers contain no business logic.
3. **`src/routes/dependencies.ts`**. Add `export const gestaoRepository = new GestaoRepository(prismaClient);`.
4. **`src/routes.ts`**. Add `router.use(gestaoRoutes);` before `restErrorHandler`.
5. **`AGENTS.md`**. Add the `gestao` module and both routes to the project snapshot, as AGENTS.md requires for any new route or module. If the code is deleted later, remove these lines too.

No test file. The change is purely additive: no existing route, repository, or GraphQL type changes.

## Verification

**Agent:** run `npx tsc --noEmit`. There are no tests to run.

**User, run manually in dev:** agents do not call live endpoints. While dev points at the prod Demeter database, every call reads the whole 7.8M-row table on prod, so run the calls outside business hours.

1. Get counts for every active code except the known large ones:

   ```sh
   curl -s -X POST http://localhost:4000/api/gestao/contagemPorPrograma \
     -H 'Content-Type: application/json' \
     -d '{"excluirCodigos":["<large code>","<large code>"]}' > /tmp/programas-contagem.json
   ```

2. Get rows for the chosen codes, at most 20 per call:

   ```sh
   curl -s -X POST http://localhost:4000/api/gestao/atendimentosPorPrograma \
     -H 'Content-Type: application/json' \
     -d '{"codigos":["50","318"]}' > /tmp/programas-atendimentos.json
   ```

## Out of scope

Leave these out unless the first results show a need:

- a date filter;
- pagination;
- caching;
- GraphQL exposure.

Once the programas are chosen, remove both routes, or keep them as internal gestão tools.
