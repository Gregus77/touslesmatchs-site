'use strict';
// Archived JSON picks cannot bypass the live quality gates or expose a free selection.
require('./publish_client_telegram').main('reminder',{schedule:false}).catch(e=>{console.error(e.message);process.exitCode=1;});
