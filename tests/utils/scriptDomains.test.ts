import { hasDomainCollision, matchesDomain, normalizeDomainRules } from '../../src/utils/scriptDomains';

describe('scriptDomains', () => {
    it('should match exact and wildcard domains', () => {
        const rules = normalizeDomainRules(['store.steampowered.com', '*.steamcommunity.com']);

        expect(matchesDomain(rules, 'store.steampowered.com')).toBe(true);
        expect(matchesDomain(rules, 'foo.steamcommunity.com')).toBe(true);
        expect(matchesDomain(rules, 'bar.example.com')).toBe(false);
    });

    it('should detect collision between wildcard and exact domains', () => {
        const left = normalizeDomainRules(['*.steampowered.com']);
        const right = normalizeDomainRules(['store.steampowered.com']);

        expect(hasDomainCollision(left, right)).toBe(true);
    });
});
