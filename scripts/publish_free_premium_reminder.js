'use strict';
require('./publish_client_telegram').main('reminder').catch(e=>{console.error(e.message);process.exitCode=1;});
