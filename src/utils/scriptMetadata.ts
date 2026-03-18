import { OpenGraphCardScriptMetadata } from '../types';

const SCRIPT_HEADER_START = '==OpenGraphCardScript==';
const SCRIPT_HEADER_END = '==/OpenGraphCardScript==';

export class InvalidScriptFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidScriptFormatError';
    }
}

export function parseScriptMetadata(scriptCode: string): OpenGraphCardScriptMetadata {
    const blockMatch = scriptCode.match(new RegExp(`${SCRIPT_HEADER_START}([\\s\\S]*?)${SCRIPT_HEADER_END}`));
    if (!blockMatch) {
        throw new InvalidScriptFormatError('Invalid Script Format: metadata block not found');
    }

    const block = blockMatch[1];
    const name = extractMetadataValue(block, 'name');
    const version = extractMetadataValue(block, 'version');
    const author = extractMetadataValue(block, 'author');
    const domainsRaw = extractMetadataValue(block, 'domains');
    const coverRaw = extractMetadataValue(block, 'cover');

    if (!name || !version || !author || !domainsRaw || !coverRaw) {
        throw new InvalidScriptFormatError('Invalid Script Format: required metadata fields missing');
    }

    const domains = domainsRaw
        .split(',')
        .map(domain => domain.trim().toLowerCase())
        .filter(Boolean);

    if (domains.length === 0) {
        throw new InvalidScriptFormatError('Invalid Script Format: @domains is empty');
    }

    const cover = parseBoolean(coverRaw);
    if (cover === null) {
        throw new InvalidScriptFormatError('Invalid Script Format: @cover must be true or false');
    }

    return {
        name,
        version,
        author,
        domains,
        cover
    };
}

function extractMetadataValue(block: string, key: string): string | null {
    const match = block.match(new RegExp(`@${key}\\s+(.+)`));
    return match?.[1]?.trim() || null;
}

function parseBoolean(value: string): boolean | null {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
        return true;
    }
    if (normalized === 'false') {
        return false;
    }
    return null;
}
