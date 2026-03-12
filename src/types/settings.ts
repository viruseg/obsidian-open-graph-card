export interface OpenGraphSettings {
    proxy: string;
    saveImagesLocally: boolean;
}

export const DEFAULT_SETTINGS: OpenGraphSettings = {
    proxy: '',
    saveImagesLocally: false
};
