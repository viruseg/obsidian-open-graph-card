import { InvalidScriptFormatError, parseScriptMetadata } from '../../src/utils/scriptMetadata';

describe('scriptMetadata', () => {
    it('should parse required metadata fields', () => {
        const code = `/**
* ==OpenGraphCardScript==
* @name Steam Parser
* @version 1.2.3
* @author Valve
* @domains store.steampowered.com, *.steamcommunity.com
* @cover true
* ==/OpenGraphCardScript==
*/`;

        const metadata = parseScriptMetadata(code);

        expect(metadata.name).toBe('Steam Parser');
        expect(metadata.version).toBe('1.2.3');
        expect(metadata.author).toBe('Valve');
        expect(metadata.cover).toBe(true);
        expect(metadata.domains).toEqual(['store.steampowered.com', '*.steamcommunity.com']);
    });

    it('should throw InvalidScriptFormatError when required field missing', () => {
        const code = `/**
* ==OpenGraphCardScript==
* @name Steam Parser
* @version 1.2.3
* @author Valve
* @cover true
* ==/OpenGraphCardScript==
*/`;

        expect(() => parseScriptMetadata(code)).toThrow(InvalidScriptFormatError);
    });
});
