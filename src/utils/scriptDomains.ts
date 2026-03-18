import { DomainRule } from '../types';

const HOSTNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/;

export function normalizeDomainRule(value: string): DomainRule {
    const raw = value.trim().toLowerCase();
    if (!raw) {
        throw new Error('Domain rule is empty');
    }

    if (raw.startsWith('*.')) {
        const base = raw.slice(2);
        if (!isValidHostname(base)) {
            throw new Error(`Invalid wildcard domain: ${value}`);
        }

        return {
            raw,
            normalized: base,
            type: 'wildcard'
        };
    }

    if (!isValidHostname(raw)) {
        throw new Error(`Invalid domain: ${value}`);
    }

    return {
        raw,
        normalized: raw,
        type: 'exact'
    };
}

export function normalizeDomainRules(values: string[]): DomainRule[] {
    return values.map(normalizeDomainRule);
}

export function matchesDomain(rules: DomainRule[], hostname: string): boolean {
    const host = hostname.trim().toLowerCase();
    return rules.some(rule => matchesRule(rule, host));
}

export function hasDomainCollision(left: DomainRule[], right: DomainRule[]): boolean {
    return left.some(l => right.some(r => rulesOverlap(l, r)));
}

function matchesRule(rule: DomainRule, host: string): boolean {
    if (rule.type === 'exact') {
        return rule.normalized === host;
    }

    return host === rule.normalized || host.endsWith(`.${rule.normalized}`);
}

function rulesOverlap(a: DomainRule, b: DomainRule): boolean {
    if (a.type === 'exact' && b.type === 'exact') {
        return a.normalized === b.normalized;
    }

    if (a.type === 'wildcard' && b.type === 'wildcard') {
        return a.normalized === b.normalized
            || a.normalized.endsWith(`.${b.normalized}`)
            || b.normalized.endsWith(`.${a.normalized}`);
    }

    const wildcard = a.type === 'wildcard' ? a : b;
    const exact = a.type === 'exact' ? a : b;
    return matchesRule(wildcard, exact.normalized);
}

function isValidHostname(value: string): boolean {
    if (!HOSTNAME_PATTERN.test(value)) {
        return false;
    }

    return value.split('.').every(label => label.length > 0 && label.length <= 63);
}
