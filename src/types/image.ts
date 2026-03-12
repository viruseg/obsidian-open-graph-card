export interface ImageSourceClassification {
    type: 'local' | 'url' | 'mixed' | 'empty';
    localPaths: string[];
    urlPaths: string[];
}
