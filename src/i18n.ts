import english from '../public/_locales/en/messages.json';
import simplifiedChinese from '../public/_locales/zh_CN/messages.json';

type Message = keyof typeof english;
const locale = navigator.language.toLowerCase();
const useChinese = locale === 'zh' || /^zh-(hans|cn|sg)(-|$)/.test(locale);
const messages: typeof english = useChinese ? simplifiedChinese : english;

export const language = useChinese ? 'zh-CN' : 'en';

export function t(key: Message, value?: string) {
  const message = messages[key].message;
  return value === undefined ? message : message.replace('$1', () => value);
}
