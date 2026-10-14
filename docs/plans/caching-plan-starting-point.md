# Implementing a robust caching solution for Demeter getway

1. Intro
   This is just a starting-point-plan to Implementing a robust caching solution for Demeter getway. From this doc, it is expected a plan to be created, then we will write code.

2. Data source
   Data will come from DemeterDB, the external, bloated old company DB.
   It has pg v9 and hundreds of tables, lots of joins/associations and some of them with 1-6 million rows and even without a FK index, which makes sql queries VERY slow.

this file has the schema for the relevant tables:
/home/apps/emater_graphql_server/prisma/schema.prisma

3. Goal
   The goal is to create a fast, somewhat updated/fresh and reliable way to bypass/skip hits to that DB for a few tables in the DB. The target will be around 10-20 tables, but some of them will have 1-8 million rows, and they need JOINS between them so that fetched data can make any sense for humans. these joins are required because these tables are nothing but a gathering of FK/ foreign ids. So it requires several joins so one can link relevant data and finally reach the related lookup table which would have some sort of description of what all thes ids / FKs are all about.

2 main sub goals:
3.1 Consolidate data and reports
Gathered data will be served as JSON, so client APIs can generate reports for strategic high level management of the company. For that, counts, averages, dateFilters will matter, not detail about each atendimento

3.2 Fasten up existing client requests
Since this Gateway/repo (emater_graphql_server) already fetches data from the external DB and will start caching data, the idea here is to hit the cache instead of reaching the DB for some specific existing requests. Note that some existing requests will still require a new DB fetch every time, because they must have the most updated data. This 3.2 sub goal will replace DB fetch for cahced data for only a few specific existing client requests.

4. Target tables

All this project will mostly be centered around at_atendimento table.
the thing is it has a lot of linked tables. The most important ones:

- at_atendimento_indicador: links to which "programa/meta da empresa". got 7.8million rows
- at_atendimento_usuario (link to which "extensionista" did the job)
- at_cli_atend_prop (links to which produtor/propriedade was assisted.)

5. Target data

While several 1-8million row tables with a lot of joins might sound overwhelming, not all data is relevant. What will be ignored/filtered out:

- Very old data is not relevant for this project, so the idea is to cache the last 2years of data. This way, cached rows might reduce the data to 20-30% of the original source. So a 6million row might become a 2million row.
- Since almost everything where will be centered around at_atendimento table (explained below, #4), we will also filter out the atendimentos which has "ativo" col === false. That might drop a 2million (date filtered) row to a 1.1 million row data (estimate).

6. Cache flush/refresh
   Some ideas here.

Most tables are not mutable. at_atendimento almost never gets updated. And the col updates that matter will be the "ativo". Everything else is changed in a secondary table, but atendimento row remains the same.

at_atendimento also never gets deleted. Theres that "soft delete" comapny rule that update the col "ativo" to false, and that is considered a "delete". So when a extensionista "updates/fixes" his atendimento, a new row is created with a "at_atendimento_anterior" col pointing to the old atendimento_id. The old one gets a ativo === false. If extensionista changes again the same "atendimento", then it istarts a chain of atendimentos pointing to the previous atendimento. I know, very bad, but it is what it is. And it gets worse.

About that update in secondary table, it gets even worse: sometimes a "table4" get updated, and the same "soft delete" happens. Like, for example, this may cause an atendimento "soft delete, even if the relation is like this:
at_atendimento>>table1>>table2>>table3>>table4(updated)

That table4 update wont matter for our project though.

For this project, we will filter out atendimento.ativo ===false. That's why refresh caching gets tricky. 2 ideas

6.1 Incremental caching
The ideia here is simple: Since most tables are not mutable (if not all), we will NOT refresh the whole dataset. The idea is incremental caching instead of get data all over again from zero. Something like: set a crontab at 12am, 6am, 12pm 4pm. Then get the last data from each table. This is tricky though, because "soft delete" might have happened in a already fetched and cached atendimento.

6.2 One big refresh, 12am
Refetch all data, once a day. Then all data will be referred as "data until yestarday". Good fit for goal #3.1, might be usefull for some endpoints for goal 3.2.

6.3 Mix of 6.1 and 6.2
Big refresh every weekday at 12am, a few small cache refreshes during the day, for specific datasets.

7. What is the best Db to pick for the job:

A web Research must be made here, to get the most recent options and cutting edge tech DBs. Free/Open source only.

I dont care for schema/sql/noSql stuff. Just the fastest +lightweight + KISS option will be the most suitable for the job. So, whatever it will be Redis, MongoDB, couchDB, cassandra, dragonFly, postgres, or any better option. I dont care. The best wins.

It should be the #1 choice for the balance fast, lightweight, KISS. Speciffically for this project, fast+lightweight wins over KISS.

it should be confortable handling these million row tables. Important remark here: the million-row-tables have all the same structure: text/numbers datastructure, like a 7col table in postgres: 4 int8, 1 int4, 1 date, 1varchar(5). Whatever DB is picked, it should be able to handle easily 200k-2million rows/records per table/collection (remember, we will cache only filtered data, not the whole set)

7.1 InMemory cache
InMemory cache already exists in this repo, and it should be kept. This caches very small lookup tables with almost no updates/inserts/deletes. It already works fine, we will not change this, but take advantage of those already cached in tables instead. Code is already written and working fine. If it ain't broken, dont fix it. We uss KISS for this one.

8. Implementation

Important thing about this plan: some phases might be NEVER implemented and it is ok. So let's go 1 step at a time.

8.1 Phase 1 - enought data to attend to #3.1 goal
Yeap, that's it. Mostly counts and filters, so this repo can store as cache and send JSON data so whatever consumer app can render dashboards. Mostly counts to understand how many atendimentos per empresa program with date-ranges. Remember, only data from 2025 on. Also, the timestamp on each row might be enough so this repo aggregates them in a "monthly number" and hand a small JSON to the consumer with "monthly totals" for each company's "programa"/sector.

Not that simple, cause to make sense out of whatever data there are several joins. Look at this file, it will give a good gist of how to extract which sector belongs each atendimento:
/home/apps/emater_graphql_server/docs/atendimento.chat-sheet.js

Dashboard data will aggregate these kinda information:

- atendimentos per "programa": maybe tables such as at_atendimento_indicador, at_indicador, at_grupo_indicador, at_produto will give the data needed;
- produtores and propriedades atendidos: maybe at_atendimento with a at_cli_atend_prop, pl_propriedade and ger_pessoa. at_cli_atend_prop table is the most critical to cache, it has 6million rows and no index created for at_atendimento. Creating index is the best solution I know, but unfortunately, it is 100% OUT of the question, no can do.
- produtores and propriedades atendidos for each "programa": a mix of previous 2
- All data above filtered by municipio and regionalEmater: all data above, maybe using typescript to match/filter by municipio/regional. Not hard, at_atendimento, pl_propriedade, ger_pessoa, all have id_und_empresa col. Remember, there is a cannonical 'getMuncipiosEmater' or whatever query already built in this repo. That will act as a lookup table and "translate" any id_und_empresa into a full readable object with nomeMunicipio, nomeRegional, idRegional, etc.

  8.2 Phase 2 - extend cache already created to existing endpoints in apps

This one might never get started. Its ok. It is just a nice to have.

Once we are 100% done with phase 1, we might peak at what consumers are fetching from this DemeterGateway api and start hitting the cache instead of the DB for a few endpoints. Note that some endpoints consumers hit actually need to hit DemeterDB, so these would be out of scope of this phase.

A SMALL change in ohase 8.1 to fit this phase is also acceptable.

9. Final notes

Always respect AGENTS.md of this repo and read AGENTS.md of whatever other repo u may need to read files from.

AI Agents must NEVER edit, create or remove ANYfiles in sibbling folders, outside of /home/apps/emater_graphql_server.

AI Agents must NEVER hit ANY DB, nor create, recreate, start, stop, remove or change any docker container.

Always respect this repo's hard rules, coding styles, etc in AGENTS.md
