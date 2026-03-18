export class App {
  vault = {
    getAbstractFileByPath: jest.fn(),
    read: jest.fn(),
    cachedRead: jest.fn(),
    write: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    rename: jest.fn(),
    adapter: {
      exists: jest.fn().mockResolvedValue(true),
      read: jest.fn().mockResolvedValue(''),
      write: jest.fn().mockResolvedValue(undefined),
      mkdir: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined)
    }
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
export const sanitizeHTMLToDom = jest.fn((html: string) => {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
});
