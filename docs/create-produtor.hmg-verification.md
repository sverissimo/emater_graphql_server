# createProdutor — HMG verification procedure (user-executed)

Manual end-to-end checks against **HMG (port 4100)**. Per AGENTS.md, agents never hit live
endpoints — you run these and paste the output back for review. Run in order; each step
says what to expect. Replace `$TOKEN` with a valid service JWT (signed with `SERVICE_TOKEN`).
Do not paste the token itself into review output.

> CPF fixture: use a **valid, unused** CPF per run (check-digit-valid; the validator rejects
> fake ones like `111.111.111-11`). Generate one and note it for cleanup. The examples below
> use `__CPF__` / `__CPF2__` / `__CPF3__` / `__CPF4__` as placeholders. Track every returned id.

## 0. Preflight (run FIRST, once per environment)

Run the permission queries while connected as the same PostgreSQL role used by the HMG gateway.
Every result must be `true`.

```sql
SELECT current_user;

SELECT table_name,
       has_table_privilege(current_user, format('public.%I', table_name), 'SELECT') AS can_select,
       has_table_privilege(current_user, format('public.%I', table_name), 'INSERT') AS can_insert
FROM (VALUES
  ('ger_pessoa'),
  ('ger_end_pessoa'),
  ('ger_pes_cat_ramo_relacao'),
  ('sub_categoria_pessoa_relacao'),
  ('contato_pessoa'),
  ('pl_propriedade'),
  ('pl_propriedade_ger_pessoa')
) AS required(table_name)
ORDER BY table_name;

SELECT table_name,
       sequence_name,
       sequence_name IS NOT NULL
         AND has_sequence_privilege(current_user, sequence_name, 'USAGE') AS can_use_sequence
FROM (
  SELECT table_name,
         pg_get_serial_sequence(
           format('public.%I', table_name),
           pk_column
         ) AS sequence_name
  FROM (VALUES
    ('ger_pessoa', 'id_pessoa_demeter'),
    ('ger_end_pessoa', 'id_end_pessoa_demeter'),
    ('ger_pes_cat_ramo_relacao', 'id_pes_cat_ramo_relacao_demeter'),
    ('sub_categoria_pessoa_relacao', 'id'),
    ('contato_pessoa', 'id_contato_pessoa'),
    ('pl_propriedade', 'id_pl_propriedade')
  ) AS required(table_name, pk_column)
) AS sequences
ORDER BY table_name;

SELECT table_name,
       has_table_privilege(current_user, format('public.%I', table_name), 'SELECT') AS can_select
FROM (VALUES
  ('ger_und_empresa'),
  ('sep_municipio'),
  ('ger_cat_pessoa'),
  ('sub_categoria_pessoa'),
  ('tipo_contato_pessoa'),
  ('sep_tpo_logradouro')
) AS required(table_name)
ORDER BY table_name;
```

Then confirm the hard-coded constants resolve to the expected labels in this DB before any write:

```sql
SELECT 'cat'  AS k, id_cat_pessoa::text  AS id, ds_cat_pessoa  AS label FROM ger_cat_pessoa        WHERE id_cat_pessoa = 39
UNION ALL
SELECT 'sub',        id::text,                  descricao             FROM sub_categoria_pessoa  WHERE id = 1
UNION ALL
SELECT 'tel',        id_tipo_contato_pessoa::text, descricao          FROM tipo_contato_pessoa   WHERE id_tipo_contato_pessoa IN (1, 3)
UNION ALL
SELECT 'logr',       id_tpo_logradouro::text,  ds_tpo_logradouro      FROM sep_tpo_logradouro    WHERE id_tpo_logradouro IN (1,2,3,4,5,6,7,8);
```

Expected: `39 = Agricultor Familiar` (if it returns something else, STOP before writes),
`1 = Típico(a)` for sub, `1 = Comercial` /
`3 = Celular`, and the eight logradouro labels (Rua, Avenida, Praça, Rodovia, Alameda, Beco,
Travessa, Sítio).

## 1. Local verification

Run from the repository root:

```bash
npx tsc --noEmit
npx prisma validate
node --import tsx --test \
  src/modules/produtor/ProdutorDataMapper.test.ts \
  src/modules/produtor/produtorValidation.test.ts \
  src/modules/produtor/produtorResolver.test.ts \
  src/modules/produtor/repository/ProdutorRepository.test.ts
```

Expect all commands to exit successfully. These tests verify payload shape and error handling;
they do not prove a real PostgreSQL transaction rollback.

## 2. Dropdown endpoint

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4100/api/getMunicipiosEmater | head -c 600
```

Expect: JSON array, snake_case keys (`id_und_empresa`, `nome_municipio`, `municipio_id`,
`regional_id`, `nome_regional`), only `H*` units, ordered by município name, no nulls.
**Pick one row** and use its `id_und_empresa` + `municipio_id` below.

Also confirm the old route is untouched:

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4100/api/getRegionaisEmater | head -c 300
```

## 3. Minimal create (3 rows)

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"mutation($i: CreateProdutorInput!){ createProdutor(input: $i) { produtorId propriedadeId } }","variables":{"i":{"nome":"TESTE HMG createProdutor","cpf":"__CPF__","unidadeEmpresa":"__H_ID__","municipioId":__MUN_ID__}}}' \
  http://localhost:4100/
```

Expect: `{"data":{"createProdutor":{"produtorId":"<new id as string>","propriedadeId":null}}}`.
Note the id as `__ID__`.

```sql
SELECT id_pessoa_demeter, nm_pessoa, nr_cpf_cnpj, id_und_empresa, dt_update_record, id_sincronismo
  FROM ger_pessoa WHERE id_pessoa_demeter = __ID__;
SELECT fk_cat_pessoa, id_und_empresa, dt_update_record, id_sincronismo
  FROM ger_pes_cat_ramo_relacao WHERE fk_pessoa = __ID__;
SELECT fk_sub_cat_pessoa, id_und_empresa, dt_update_record, id_sincronismo
  FROM sub_categoria_pessoa_relacao WHERE fk_pessoa = __ID__;
SELECT count(*) AS enderecos FROM ger_end_pessoa  WHERE fk_pessoa = __ID__;
SELECT count(*) AS contatos  FROM contato_pessoa  WHERE id_pessoa = __ID__;
```

Expect: 1 ger_pessoa row (CPF stored as bare digits, `id_sincronismo` DB-generated,
`dt_update_record` set); categoria rows with **39** and **1**; zero endereços/contatos.

## 4. Full create (5 rows)

New CPF, same unit. `logradouro` starts with "Rua" and `telefone` is an 11-digit mobile:

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"mutation($i: CreateProdutorInput!){ createProdutor(input: $i) { produtorId propriedadeId } }","variables":{"i":{"nome":"TESTE HMG full","cpf":"__CPF2__","unidadeEmpresa":"__H_ID__","municipioId":__MUN_ID__,"telefone":"(33) 99999-8888","endereco":{"logradouro":"Rua das Hortas","numero":"100","bairro":"Centro","cep":"36000000"}}}}' \
  http://localhost:4100/
```

Expect a new `produtorId` (note it as `__ID2__`) with `propriedadeId: null`.

```sql
SELECT id_und_empresa FROM ger_pessoa WHERE id_pessoa_demeter = __ID2__;
SELECT fk_cat_pessoa, id_und_empresa
  FROM ger_pes_cat_ramo_relacao WHERE fk_pessoa = __ID2__;
SELECT fk_sub_cat_pessoa, id_und_empresa
  FROM sub_categoria_pessoa_relacao WHERE fk_pessoa = __ID2__;
SELECT tp_endereco, fk_municipio, fk_tpo_logradouro, fk_distrito, id_und_empresa, dt_update_record
  FROM ger_end_pessoa WHERE fk_pessoa = __ID2__;
SELECT telefone, principal, id_tipo_contato_pessoa, fk_operadora, id_und_empresa
  FROM contato_pessoa WHERE id_pessoa = __ID2__;
```

Expect: `tp_endereco = 1`, `fk_municipio = __MUN_ID__`, `fk_tpo_logradouro = 1` (Rua),
`fk_distrito IS NULL`; `telefone = '33999998888'` (digits only), `principal = true`,
`id_tipo_contato_pessoa = 3` (celular), `fk_operadora IS NULL`. Every row's `id_und_empresa`
equals the sent value.

## 5. Create with propriedade (5 rows: 3 produtor + 2 propriedade)

New CPF. The propriedade carries its own `municipioId`/`unidadeEmpresa` (here the same values,
but they are independent client fields):

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"mutation($i: CreateProdutorInput!){ createProdutor(input: $i) { produtorId propriedadeId } }","variables":{"i":{"nome":"TESTE HMG propriedade","cpf":"__CPF3__","unidadeEmpresa":"__H_ID__","municipioId":__MUN_ID__,"propriedade":{"nome":"TESTE HMG Sitio","areaTotal":12.5,"geoPontoTexto":"POINT(-43.9 -19.9)","municipioId":__MUN_ID__,"unidadeEmpresa":"__H_ID__"}}}}' \
  http://localhost:4100/
```

Expect both ids non-null. Note them as `__ID3__` / `__PROP_ID__`.

```sql
SELECT nome_propriedade, area_total, geo_ponto_texto, id_municipio, id_und_empresa, ativo,
       logradouro, bairro, cep, id_distrito,
       id_sincronismo IS NOT NULL AS tem_sincronismo, dt_update_record
  FROM pl_propriedade WHERE id_pl_propriedade = __PROP_ID__;
SELECT id_pl_propriedade, id_pessoa_demeter, id_und_empresa, id_pl_tipo_posse, dt_update_record
  FROM pl_propriedade_ger_pessoa WHERE id_pessoa_demeter = __ID3__;
```

Expect: the five requirement columns populated exactly as sent (`area_total = 12.5000`),
`ativo = true` (repo-set), every other writable column `NULL`, `id_sincronismo` DB-generated,
`dt_update_record` set; one join row linking `__PROP_ID__` + `__ID3__` with the sent
`id_und_empresa` and `id_pl_tipo_posse IS NULL`.

## 6. Silent-failure cases (each returns `{"data":{"createProdutor":null}}`, HTTP 200, no error body)

1. **Duplicate CPF** — repeat the minimal create with the same `__CPF__`. Expect `null`; confirm via SQL
   that **no new rows** appeared (count by CPF stays 1).
2. **Invalid unit** — `unidadeEmpresa: "H9999"` (nonexistent). Expect `null`, no insert.
3. **Município mismatch** — valid `unidadeEmpresa` + wrong `municipioId` (e.g. `1`). Expect `null`, no insert.
4. **Invalid CPF** — `cpf: "12345678900"` (bad check digit). Expect `null`, no insert.
5. **Blank propriedade nome** — repeat step 5's payload with a fresh CPF and
   `propriedade.nome: " "`. Expect `null` (validation failure), no insert.
6. **Invalid propriedade unit — proves rollback** — repeat step 5's payload with `__CPF4__` and
   `propriedade.unidadeEmpresa: "H9999"`. The root ger_pessoa insert succeeds inside the
   transaction, then the join-row unit `connect` fails — expect `null`, then:

   ```sql
   SELECT count(*) FROM ger_pessoa WHERE nr_cpf_cnpj = '__CPF4_DIGITS__'; -- expect 0 (rolled back)
   ```

7. **Invalid propriedade município (also rollback)** — same with valid units but
   `propriedade.municipioId: 999999`. FK violation on `pl_propriedade.id_municipio`; expect `null`
   and count 0 for that CPF.
8. **Coercion error (NOT silent, by design)** — send `municipioId: "abc"`. Expect a standard
   GraphQL error (`Int cannot represent...`) — this is the documented pre-execution surface.

### Transaction rollback

Cases 6–7 above now prove PostgreSQL rollback through the normal API: the propriedade leg fails
**after** the root row insert inside the single Prisma nested `create` (one implicit transaction),
and the CPF count staying 0 shows the produtor row was rolled back with it. No fault-injection
window needed anymore.

## 7. Log review

```bash
grep "createProdutor" logs/hmg/errors-*.log | tail -30
```

The rotating files contain **error-level lines only**. Expect one line per failure
(`execution_failure class=duplicate_cpf`, `invalid_unit`, `municipio_mismatch`,
`validation_failure`, and for cases 6–7 `execution_failure class=prisma_P2025` /
`prisma_P2003`) and no duplicate failure lines.

Attempts and successes are `info` level and appear in the HMG process/container output, not in the
error-only files. Review the relevant container output manually and confirm one `attempt`
(now ending in `propriedade=true|false`) plus one
`success ... id_pessoa_demeter=... id_pl_propriedade=...` for each successful create
(`id_pl_propriedade=none` for steps 3–4).

Across both outputs, verify no CPF, phone, address, token, or full payload appears.

## 8. Cleanup

The propriedade FKs are all `NoAction` — nothing cascades from `ger_pessoa`, so delete the
propriedade rows explicitly and in this order:

```sql
DELETE FROM contato_pessoa            WHERE id_pessoa IN (__ID__, __ID2__, __ID3__);         -- NoAction FK: delete first
DELETE FROM pl_propriedade_ger_pessoa WHERE id_pessoa_demeter IN (__ID__, __ID2__, __ID3__); -- before its two parents
DELETE FROM pl_propriedade            WHERE id_pl_propriedade = __PROP_ID__;
DELETE FROM ger_pessoa                WHERE id_pessoa_demeter IN (__ID__, __ID2__, __ID3__); -- Cascade removes the rest
SELECT count(*) FROM ger_pessoa
  WHERE id_pessoa_demeter IN (__ID__, __ID2__, __ID3__)
     OR nr_cpf_cnpj IN ('__CPF_DIGITS__', '__CPF2_DIGITS__', '__CPF3_DIGITS__', '__CPF4_DIGITS__'); -- expect 0
SELECT count(*) FROM contato_pessoa WHERE id_pessoa IN (__ID__, __ID2__, __ID3__);                  -- expect 0
SELECT count(*) FROM ger_end_pessoa WHERE fk_pessoa IN (__ID__, __ID2__, __ID3__);                  -- expect 0
SELECT count(*) FROM pl_propriedade_ger_pessoa WHERE id_pessoa_demeter IN (__ID__, __ID2__, __ID3__); -- expect 0
SELECT count(*) FROM pl_propriedade WHERE id_pl_propriedade = __PROP_ID__;                          -- expect 0
```

## Result log

| Step | Status | Notes |
| ---- | ------ | ----- |
| 0 permissions + lookup ids |  |  |
| 1 local verification |  |  |
| 2 dropdown |  |  |
| 3 minimal create |  |  |
| 4 full create |  |  |
| 5 create with propriedade |  |  |
| 6 silent failures |  |  |
| rollback (cases 6–7) |  |  |
| 7 logs |  |  |
| 8 cleanup |  |  |
