"use strict";

const fs=require("fs");
const assert=require("assert");

const i18n=fs.readFileSync("public/js/i18n-auto.js","utf8");
const index=fs.readFileSync("public/index.html","utf8");
const app=fs.readFileSync("public/app.html","utf8");
const lifecycle=fs.readFileSync("public/js/match-lifecycle.js","utf8");
const sw=fs.readFileSync("public/sw.js","utf8");

for(const lang of ["fr","en","es","pt","ru","
