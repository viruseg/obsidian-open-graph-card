export interface ImageSourceClassification {
    type: 'local' | 'url' | 'mixed' | 'empty';
    localPaths: string[];
    urlPaths: string[];
}

export interface ImageDataUrlInfo {
    elementIndex: number;
    src: string;
    dataUrl: string | null;
}

export interface ImageDownloadResult {
    success: boolean;
    downloadedCount: number;
    failedCount: number;
    errors: string[];
}

export interface ImageRestoreResult {
    success: boolean;
    restoredCount: number;
    failedCount: number;
    errors: string[];
}
