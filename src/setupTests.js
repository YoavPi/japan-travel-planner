// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom (used by react-scripts 5 / Jest 27) ships no TextEncoder/TextDecoder,
// which react-router v7 references at import time. Node provides them via `util`.
import { TextEncoder, TextDecoder } from 'util';
if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;

// jsdom also ships no PointerEvent (see https://github.com/jsdom/jsdom/issues/2527),
// so @testing-library/dom's fireEvent.pointerDown/Move/Up silently falls back to a
// plain `Event` that drops clientX/clientY/pointerId/pointerType from the init dict —
// any test asserting on those properties (e.g. StopCard's badge drag-vs-tap gesture
// split) would see them all as undefined. MouseEvent already carries clientX/clientY
// correctly in jsdom, so the fix is a minimal polyfill built on top of it.
if (typeof global.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? 'mouse';
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  global.PointerEvent = PointerEvent;
  window.PointerEvent = PointerEvent;
}
