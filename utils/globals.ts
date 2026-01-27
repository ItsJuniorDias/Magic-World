// globals.js ou topo do App.js
global.window = global.window || {};
global.window.addEventListener = () => {};
global.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  createElement: () => ({
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    appendChild: () => {},
    getContext: () => ({}),
  }),
  getElementsByTagName: () => [],
  body: {
    appendChild: () => {},
  },
};
