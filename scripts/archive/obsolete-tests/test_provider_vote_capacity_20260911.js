#!/usr/bin/env node
"use strict";
const fs=require("fs"),assert=require("assert");
const src=fs.readFileSync("scripts/api_server.js","utf8");
const roster=src.slice(src.indexOf("const agentNames = ["),src.indexOf("const CHIEF_INDEX",src.indexOf("const agentNames = [")));
assert.match(roster,/name: "Cohere-Command"/);
assert.match(roster,/command-a-plus-05-2026/);
assert.doesNotMatch(roster,/name: "Qwen-3\.7-Max"/);
const routing=src.slice(src.indexOf("let providers = []",src.indexOf("async function runSingleAgent")),src.indexOf("providers = providers.filter",src.indexOf("async function runSingleAgent")));
assert(routing.indexOf("api.mistral.ai") < routing.indexOf("openrouter.ai/api/v1/chat/completions"),"Mistral direct doit précéder OpenRouter");
assert(routing.indexOf("api.deepseek.com") < routing.indexOf("openrouter.ai/api/v1/chat/completions"),"DeepSeek direct doit précéder OpenRouter");
assert(routing.indexOf("api.cohere.com") < routing.indexOf("openrouter.ai/api/v1/chat/completions"),"Cohere direct doit précéder OpenRouter");
const audit=src.slice(src.indexOf("async function auditAndRepairModels"),src.indexOf("// ── Promotion",src.indexOf("async function auditAndRepairModels")));
assert(audit.indexOf("return { lignes: catalogueLines") < audit.indexOf("await sondeModele"),"l'audit ordinaire doit sortir avant toute inférence");
console.log("OK: Cohere restauré, fournisseurs directs prioritaires, audit OpenRouter sans inférence");
