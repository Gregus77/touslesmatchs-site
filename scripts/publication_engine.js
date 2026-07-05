const { bus, EVENT_NAMES } = require("./event_bus");

const DEFAULT_CONFIG = {
  MIN_PUBLICATION_MINUTE: 30,
  MAX_PUBLICATION_MINUTE: 75,
  MIN_CONFIDENCE: 65,
  MIN_CONSENSUS: 3,
  PUBLICATION_INTERVAL_MINUTES: 5,
};

function loadConfig(env = process.env) {
  return {
    MIN_PUBLICATION_MINUTE: parseInt(env.MIN_PUBLICATION_MINUTE) || DEFAULT_CONFIG.MIN_PUBLICATION_MINUTE,
    MAX_PUBLICATION_MINUTE: parseInt(env.MAX_PUBLICATION_MINUTE) || DEFAULT_CONFIG.MAX_PUBLICATION_MINUTE,
    MIN_CONFIDENCE: parseInt(env.MIN_CONFIDENCE) || DEFAULT_CONFIG.MIN_CONFIDENCE,
    MIN_CONSENSUS: parseInt(env.MIN_CONSENSUS) || DEFAULT_CONFIG.MIN_CONSENSUS,
    PUBLICATION_INTERVAL_MINUTES: parseInt(env.PUBLICATION_INTERVAL_MINUTES) || DEFAULT_CONFIG.PUBLICATION_INTERVAL_MINUTES,
  };
}

function evaluatePublication(analysis, matchMinute, config, snapshotStore) {
  const minute = parseInt(matchMinute) || 0;
  const confidence = analysis.confidence || 0;
  const consensusVotes = analysis.consensus_votes || 0;
  const matchKey = analysis.match_key;

  if (snapshotStore.hasSnapshot(matchKey)) {
    return { decision: "BLOCKED", reason: "Snapshot already exists — immutable" };
  }

  if (minute < config.MIN_PUBLICATION_MINUTE) {
    return { decision: "WAIT", reason: `Too early: ${minute}' < ${config.MIN_PUBLICATION_MINUTE}' minimum` };
  }

  if (minute > config.MAX_PUBLICATION_MINUTE) {
    return { decision: "BLOCKED", reason: `Too late: ${minute}' > ${config.MAX_PUBLICATION_MINUTE}' maximum` };
  }

  if (confidence < config.MIN_CONFIDENCE) {
    return { decision: "WAIT", reason: `Low confidence: ${confidence}% < ${config.MIN_CONFIDENCE}% minimum` };
  }

  if (consensusVotes < config.MIN_CONSENSUS) {
    return { decision: "WAIT", reason: `Weak consensus: ${consensusVotes}/5 < ${config.MIN_CONSENSUS}/5 minimum` };
  }

  return { decision: "PUBLISH", reason: `OK: ${minute}', ${confidence}%, ${consensusVotes}/5 consensus` };
}

class PublicationEngine {
  constructor({ snapshotStore, config, onPublish } = {}) {
    this._snapshotStore = snapshotStore;
    this._config = config || loadConfig();
    this._onPublish = onPublish || (() => {});
  }

  process(analysis, match) {
    const minute = parseInt(match.minute) || 0;
    const evaluation = evaluatePublication(analysis, minute, this._config, this._snapshotStore);

    if (evaluation.decision === "PUBLISH") {
      const snapshot = this._snapshotStore.createSnapshot(analysis, match, minute);
      bus.publish(EVENT_NAMES.OFFICIAL_PREDICTION_PUBLISHED, snapshot);
      this._onPublish(snapshot);
      return { ...evaluation, snapshot };
    }

    if (evaluation.decision === "BLOCKED" && this._snapshotStore.hasSnapshot(analysis.match_key)) {
      this._snapshotStore.savePostPublicationAnalysis(analysis, match, minute);
      bus.publish(EVENT_NAMES.POST_PUBLICATION_ANALYSIS, { match_key: analysis.match_key, minute, analysis });
    }

    if (evaluation.decision === "BLOCKED" && evaluation.reason.includes("Too late")) {
      bus.publish(EVENT_NAMES.PREDICTION_REJECTED, { match_key: analysis.match_key, minute, reason: evaluation.reason });
    }

    return evaluation;
  }

  getConfig() {
    return { ...this._config };
  }

  updateConfig(partial) {
    Object.assign(this._config, partial);
  }
}

module.exports = { PublicationEngine, evaluatePublication, loadConfig, DEFAULT_CONFIG };
