import { describe, expect, it } from 'vitest';
import config from '../../studio/sanity.config';
import { siteSettings } from '../../studio/schemaTypes/site-settings';

const initialValueOf = (name: string) =>
  (
    siteSettings.fields.find((f) => f.name === name) as
      { initialValue?: unknown } | undefined
  )?.initialValue;

describe('studio config', () => {
  it('keeps the siteSettings template so field initial values apply', () => {
    const prev = [
      {
        id: 'siteSettings',
        title: 'Site Settings',
        schemaType: 'siteSettings',
        value: {},
      },
      { id: 'sermon', title: 'Sermon', schemaType: 'sermon', value: {} },
    ];
    const templates = config.schema?.templates;
    const resolved =
      typeof templates === 'function'
        ? templates(prev as never)
        : (templates ?? prev);
    expect(resolved.map((t) => t.id)).toEqual(['siteSettings', 'sermon']);
  });

  it('hides siteSettings from the new-document menu', () => {
    const prev = [{ templateId: 'siteSettings' }, { templateId: 'sermon' }];
    const options = config.document?.newDocumentOptions;
    const resolved =
      typeof options === 'function'
        ? options(prev as never, {} as never)
        : prev;
    expect(resolved.map((o) => o.templateId)).toEqual(['sermon']);
  });
});

describe('siteSettings defaults', () => {
  it('defaults service times, rows and the Entrusted toggle', () => {
    expect(initialValueOf('serviceTimes')).toEqual(['9:00', '10:45']);
    expect(initialValueOf('showEntrustedOnHome')).toBe(true);
    expect(initialValueOf('sundayCardRows')).toHaveLength(3);
  });
});
