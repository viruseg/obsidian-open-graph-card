import en from "./en";
import ru from "./ru";

const locales: Record<string, typeof en> = { en, ru };

export function t(key: string, ...args: string[]): string
{
    const locale = (window as any).moment.locale();
    const translations = locales[locale] ?? locales["en"];

    let text =
        translations[key] ||
        locales['en'][key] ||
        key;

    for (let i = 0; i < args.length; i++)
    {
        text = text.replace(`{${i}}`, args[i]);
    }
    return text;
}