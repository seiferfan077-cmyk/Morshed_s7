export type WebSpeechDiagnostic = {
  at: string;
  stage: string;
  detail?: string;
  error?: string;
};

export const WEB_SPEECH_BRIDGE_VERSION = '1.0.0';

/**
 * Installs a standards-shaped Web Speech facade in the top-level document.
 * It never injects into iframes and only communicates through the namespaced
 * ReactNativeWebView postMessage channel.
 */
export const WEB_SPEECH_INJECTED_SCRIPT = `
(function () {
  'use strict';
  if (window.__MURSHID_WEB_SPEECH__) return true;
  var rn = window.ReactNativeWebView;
  if (!rn || typeof rn.postMessage !== 'function' || window.top !== window) return true;
  var BRIDGE = 'murshid.webSpeech.v1';
  var voices = [];
  var voiceListeners = [];
  var queue = [];
  var utterances = {};
  var speaking = false;
  var paused = false;
  var requestSeq = 0;

  function send(message) {
    try { rn.postMessage(JSON.stringify(Object.assign({ bridge: BRIDGE }, message))); } catch (_) {}
  }
  function dispatch(target, type, detail) {
    if (!target) return;
    var event;
    try { event = new Event(type); } catch (_) { event = document.createEvent('Event'); event.initEvent(type, false, false); }
    if (detail) Object.keys(detail).forEach(function (key) { try { event[key] = detail[key]; } catch (_) {} });
    try { target.dispatchEvent(event); } catch (_) {}
    var handler = target['on' + type];
    if (typeof handler === 'function') { try { handler.call(target, event); } catch (_) {} }
  }
  function normalizeVoice(v) {
    return {
      voiceURI: String(v.voiceURI || v.identifier || ''),
      name: String(v.name || v.identifier || 'Android voice'),
      lang: String(v.lang || v.language || ''),
      localService: true,
      isDefault: Boolean(v.isDefault)
    };
  }
  function SpeechSynthesisVoice(v) {
    v = normalizeVoice(v || {});
    this.voiceURI = v.voiceURI; this.name = v.name; this.lang = v.lang;
    this.localService = v.localService; this.default = v.isDefault;
  }
  function SpeechSynthesisUtterance(text) {
    this._listeners = {};
    this.text = text == null ? '' : String(text);
    this.lang = ''; this.voice = null; this.volume = 1; this.rate = 1; this.pitch = 1;
    this.onstart = null; this.onend = null; this.onerror = null; this.onboundary = null;
    this.onpause = null; this.onresume = null; this.onmark = null;
  }
  SpeechSynthesisUtterance.prototype = {
    addEventListener: function (type, listener) { (this._listeners[type] = this._listeners[type] || []).push(listener); },
    removeEventListener: function (type, listener) { this._listeners[type] = (this._listeners[type] || []).filter(function (x) { return x !== listener; }); },
    dispatchEvent: function (event) { (this._listeners[event.type] || []).slice().forEach(function (listener) { try { listener.call(this, event); } catch (_) {} }, this); return true; }
  };
  SpeechSynthesisUtterance.prototype.constructor = SpeechSynthesisUtterance;
  function emitUtterance(item, type, payload) { if (item && item.utterance) dispatch(item.utterance, type, payload); }

  var synth = {
    pending: false, speaking: false, paused: false, onvoiceschanged: null,
    getVoices: function () { send({ type: 'getVoices' }); return voices.slice(); },
    speak: function (utterance) {
      if (!utterance || typeof utterance.text !== 'string') throw new TypeError('speak() expects SpeechSynthesisUtterance');
      var item = { id: 'utt-' + (++requestSeq), utterance: utterance };
      utterances[item.id] = item; queue.push(item); synth.pending = queue.length > 0; send({ type: 'speak', id: item.id, text: utterance.text, lang: utterance.lang || '', voiceURI: utterance.voice && utterance.voice.voiceURI || '', rate: utterance.rate, pitch: utterance.pitch, volume: utterance.volume });
    },
    cancel: function () { queue = []; utterances = {}; synth.pending = false; speaking = false; synth.speaking = false; send({ type: 'cancel' }); },
    pause: function () { throw new DOMException('pause() is not supported by the Android engine', 'NotSupportedError'); },
    resume: function () { throw new DOMException('resume() is not supported by the Android engine', 'NotSupportedError'); },
    addEventListener: function (type, listener) { if (type === 'voiceschanged' && typeof listener === 'function') voiceListeners.push(listener); },
    removeEventListener: function (type, listener) { if (type === 'voiceschanged') voiceListeners = voiceListeners.filter(function (x) { return x !== listener; }); }
  };
  Object.defineProperty(window, 'SpeechSynthesisVoice', { configurable: true, value: SpeechSynthesisVoice });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: SpeechSynthesisUtterance });
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
  window.__MURSHID_WEB_SPEECH__ = { version: '1.0.0', receive: function (message) {
    if (!message || message.bridge !== BRIDGE) return;
    if (message.type === 'voices') {
      voices = (message.voices || []).map(normalizeVoice);
      var event;
      try { event = new Event('voiceschanged'); } catch (_) { event = document.createEvent('Event'); event.initEvent('voiceschanged', false, false); }
      try { synth.dispatchEvent && synth.dispatchEvent(event); } catch (_) {}
      if (typeof synth.onvoiceschanged === 'function') { try { synth.onvoiceschanged.call(synth, event); } catch (_) {} }
      voiceListeners.slice().forEach(function (listener) { try { listener.call(synth, event); } catch (_) {} });
    }
    if (message.type === 'event') {
      var item = utterances[message.id];
      if (!item) return;
      if (message.event === 'start') { speaking = true; synth.speaking = true; synth.pending = false; emitUtterance(item, 'start'); }
      else if (message.event === 'boundary') emitUtterance(item, 'boundary', { charIndex: message.charIndex || 0, charLength: message.charLength || 0, name: 'word' });
      else if (message.event === 'end' || message.event === 'stopped') { emitUtterance(item, 'end'); speaking = false; synth.speaking = false; delete utterances[message.id]; synth.pending = queue.length > 0; }
      else if (message.event === 'error') { emitUtterance(item, 'error', { error: message.error || 'synthesis-failed', message: message.error || 'Native TTS error' }); speaking = false; synth.speaking = false; delete utterances[message.id]; }
    }
  }};
  send({ type: 'ready', capabilities: { speak: true, cancel: true, getVoices: true, boundary: true, pause: false, resume: false } });
  send({ type: 'getVoices' });
  true;
})();
true;`;

export function serializeBridgeMessage(message: unknown) {
  return JSON.stringify(message).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function makeBridgeDeliveryScript(message: unknown) {
  return `window.__MURSHID_WEB_SPEECH__ && window.__MURSHID_WEB_SPEECH__.receive(${serializeBridgeMessage(message)}); true;`;
}
