export const clipboard = {
  writeText: jest.fn(),
  readText: jest.fn()
};

export const ipcRenderer = {
  send: jest.fn(),
  on: jest.fn(),
  invoke: jest.fn()
};
