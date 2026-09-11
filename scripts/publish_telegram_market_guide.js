#!/usr/bin/env node
'use strict';
// --yes publishes the reviewed bilingual guide; default is preview only.
require('./publish_client_telegram').main('guide',{preview:!process.argv.includes('--yes')}).catch(e=>{console.error(e.message);process.exitCode=1;});
