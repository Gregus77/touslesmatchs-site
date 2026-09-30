'use strict';

function createSingleFlight() {
  let inFlight = null;
  return function run(task) {
    if (inFlight) return inFlight;
    inFlight = Promise.resolve(task());
    inFlight = inFlight.finally(() => { inFlight = null; });
    return inFlight;
  };
}

module.exports = { createSingleFlight };
