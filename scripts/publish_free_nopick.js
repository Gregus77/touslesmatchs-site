'use strict';
require('./publish_client_telegram').main('nopick').catch(e=>{console.error(e.message);process.exitCode=1;});
