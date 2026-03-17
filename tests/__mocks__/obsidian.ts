export class App {
  vault = {
    getAbstractFileByPath: jest.fn(),
    read: jest.fn(),
    cachedRead: jest.fn(),
    write: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    rename: jest.fn()
  };
  workspace = {
    on: jest.fn(),
    off: jest.fn(),
    trigger: jest.fn(),
    getActiveFile: jest.fn(),
    onLayoutReady: jest.fn((callback: () => void) => callback())
  };
}

export class Plugin {
  app: App;
  constructor() {
    this.app = new App();
  }
}

export class TFile {
  path: string;
  constructor(path: string) {
    this.path = path;
  }
}

export class TFolder {
  path: string;
  children: any[] = [];
  constructor(path: string) {
    this.path = path;
  }
}

export const requestUrl = jest.fn();
export const Notice = jest.fn();
export const Modal = jest.fn();
export const Setting = jest.fn();
export const PluginSettingTab = jest.fn();
