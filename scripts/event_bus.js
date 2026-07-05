const EventEmitter = require("events");

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    this._history = [];
    this._maxHistory = 200;
  }

  publish(eventName, payload) {
    const event = {
      name: eventName,
      payload,
      timestamp: new Date().toISOString(),
    };
    this._history.push(event);
    if (this._history.length > this._maxHistory) {
      this._history = this._history.slice(-this._maxHistory);
    }
    this.emit(eventName, payload);
    this.emit("*", event);
  }

  getHistory(eventName, limit = 20) {
    const filtered = eventName
      ? this._history.filter((e) => e.name === eventName)
      : this._history;
    return filtered.slice(-limit);
  }
}

const EVENT_NAMES = {
  OFFICIAL_PREDICTION_PUBLISHED: "OFFICIAL_PREDICTION_PUBLISHED",
  PREDICTION_REJECTED: "PREDICTION_REJECTED",
  POST_PUBLICATION_ANALYSIS: "POST_PUBLICATION_ANALYSIS",
};

const bus = new EventBus();

module.exports = { bus, EventBus, EVENT_NAMES };
