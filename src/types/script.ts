export interface OpenGraphCardScriptMetadata {
    name: string;
    version: string;
    author: string;
    domains: string[];
    cover: boolean;
}

export interface OpenGraphCardScriptResultBlock {
    className: string;
    htmlContent: string;
}

export interface OpenGraphCardScriptModule {
    cssStyles: string;
    processContent: (
        url: string,
        htmlString: string
    ) => OpenGraphCardScriptResultBlock[] | Promise<OpenGraphCardScriptResultBlock[]>;
    getCookie: (url: string) => string;
}

export interface DomainRule {
    raw: string;
    normalized: string;
    type: 'exact' | 'wildcard';
}
