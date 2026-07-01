# createProdutor — notes

Prose that used to clutter `create-produtor.cheat-sheet.js`. The cheat sheet is
now just the data shapes; the *why* lives here.

## Scope

What a single `createProdutor` mutation writes, table by table. Through THIS
gateway: at most **one** `endereco`, **one** `telefone` and **one** `propriedade`
per producer. The DB tables are 1:N, but multiples must go through another
interface or straight into the DB — not here.

Cheat-sheet tags:

- `*** SAVE HERE ***` → row(s) this mutation INSERTs.
- `----- LOOKUP` → read-only table; we only reference an existing id (Prisma `connect`).

## Fixed constants (authoritative)

- `ger_pes_cat_ramo_relacao.fk_cat_pessoa = 39` ("Agricultor Familiar"). The
  cheat sheet notes **35** ("Clientes") as a possible alternative — confirm
  against the lookup table before first write.
- `sub_categoria_pessoa_relacao.fk_sub_cat_pessoa = 1` ("Típico(a)").
- `ger_end_pessoa.tp_endereco = 1`. Repo-supplied, never client input.
- `ger_end_pessoa.fk_distrito = null` and `contato_pessoa.fk_operadora = null`
  — `sep_distrito` and `operadora` are ignored lookups.

All OTHER ids in the cheat sheet (municipio 845, tipo_logradouro 1, …) are
ILLUSTRATIVE placeholders to show the row shape — `municipio_id` comes from
the client's dropdown pick (`input.municipioId`); `tipo_logradouro` is derived
from `logradouro`.

## Columns handled automatically (must NOT be sent)

- `id_pessoa_demeter` / PKs → `@default(autoincrement())`.
- `id_sincronismo` → Postgres default (`uuid_generate_v4()`).
- `fk_pessoa` / `id_pessoa` → set by Prisma's nested `create` (parent back-ref).
- `dt_update_record` → repo sets `new Date()` (NOT NULL, no DB default) on every
  row that has it. `contato_pessoa` has none — its timestamp is `data_atualizacao`
  (nullable) → omit.

## From the client's dropdown selection

`getMunicipiosEmater` feeds a SELECT box; the chosen row's ids go into the input:

- `id_und_empresa` → `input.unidadeEmpresa`; SAME value written to every
  ger_pessoa/categoria/endereço/contato row. The propriedade rows use the
  separate `input.propriedade.unidadeEmpresa` (see below).
- `ger_end_pessoa.fk_municipio` → `input.municipioId`.

## Derived by the repo (NOT client input)

- `ger_end_pessoa.fk_tpo_logradouro` → `ProdutorDataMapper.tipoLogradouro(logradouro)`
  (case-insensitive on the first word), null if no match. Rules: full word
  (rua 1, avenida 2, praça/praca 3, rodovia 4, alameda 5, beco 6, travessa 7,
  sítio/sitio 8) | abbrev (`r.`→1, `av`/`av.`→2, `rod.`→4, `pç`/`pc`→3) |
  highway (`BR`/`MG`/`LMG`/`AMG` + optional space/`-` + digit → 4 Rodovia) | else null.
- `contato_pessoa.id_tipo_contato_pessoa` → 3 (celular) if the mobility digit is
  7/8/9, else 1 (Comercial). NB: the mobility digit is the 1st digit AFTER the
  2-digit DDD — for "33 9 9999-8888" it's the "9" → celular → 3.

## Optional propriedade (added after the first implementation)

`input.propriedade` adds two rows in the SAME nested write (all-or-nothing):

- `pl_propriedade` — only `nome_propriedade`, `area_total`, `geo_ponto_texto`,
  `id_municipio`, `id_und_empresa` (+ repo-set `ativo = true` and `dt_update_record`;
  `id_sincronismo` DB-generated; everything else stays NULL).
- `pl_propriedade_ger_pessoa` — join row: both ids + `id_und_empresa`.
- `propriedade.municipioId` / `propriedade.unidadeEmpresa` are client-sent and
  independent from the produtor's pair (a farm can sit in another município).
  They are NOT pre-validated — a bad value fails the FK/connect inside the
  transaction, rolls everything back, and returns the usual silent `null`.
- Return shape is `CreateProdutorResult { produtorId, propriedadeId }`;
  `propriedadeId` is null when no propriedade was sent.
- Details: [plans/produtor-propriedade-create-plan.md](plans/produtor-propriedade-create-plan.md).

## GET /api/getMunicipiosEmater

One row per active município (`ger_und_empresa` "H" rows), inner-joined to
`sep_municipio` (authoritative `nome_municipio`) and to its active "G" regional.
The user picks one; `unidadeEmpresa` + `municipioId` go into the input, and the
client keeps `regionalId`/`nomeRegional` for its own storage/filter. The INNER
joins mean an H unit with no active G parent or no município name is omitted —
no server-side name matching, no nulls in the result.

```sql
SELECT h.id_und_empresa, m.nm_municipio AS nome_municipio, h.fk_municipio AS municipio_id,
       h.fk_und_empresa AS regional_id, g.nm_und_empresa AS nome_regional
FROM ger_und_empresa h
JOIN sep_municipio m ON m.id_municipio = h.fk_municipio
JOIN ger_und_empresa g ON g.id_und_empresa = h.fk_und_empresa AND g.id_und_empresa LIKE 'G%'
WHERE h.id_und_empresa LIKE 'H%'
  AND h.fk_municipio IS NOT NULL
  AND h.sn_ativa = 1 AND g.sn_ativa = 1
  AND m.nm_municipio IS NOT NULL AND g.nm_und_empresa IS NOT NULL
ORDER BY m.nm_municipio;
```

`H%` rows = municípios (local units), `G%` rows = regionais. An H row's
`fk_und_empresa` points to its G parent. G rows normally have `fk_und_empresa`
null, but Demeter has at least one bad regional row, so treat the `id_und_empresa`
prefix (`H%`/`G%`) as the discriminator, not FK nullability.
⚠️ the existing `getRegionaisEmater` uses `LIKE '%G%'`; the new endpoint uses
`'H%'` (starts-with) for precision.
