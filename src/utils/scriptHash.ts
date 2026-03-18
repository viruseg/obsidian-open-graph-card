function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

function fallbackHash(content: string): string {
    let hash = 2166136261;
    for (let i = 0; i < content.length; i++) {
        hash ^= content.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return `fnv-${(hash >>> 0).toString(16)}`;
}

export async function calculateScriptHash(content: string): Promise<string> {
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi?.subtle) {
        return fallbackHash(content);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const digest = await cryptoApi.subtle.digest('SHA-256', data);
    return bytesToHex(new Uint8Array(digest));
}
