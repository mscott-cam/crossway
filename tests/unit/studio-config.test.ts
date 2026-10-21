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
    type Template = { id: string };
    const templates = (
      config as unknown as {
        schema?: {
          templates?: Template[] | ((prev: Template[]) => Template[]);
        };
      }
    ).schema?.templates;
    const resolved: Template[] =
      typeof templates === 'function'
        ? templates(prev as never)
        : (templates ?? prev);
    expect(resolved.map((t) => t.id)).toEqual(['siteSettings', 'sermon']);
  });

  it('hides siteSettings from the new-document menu', () => {
    const prev = [{ templateId: 'siteSettings' }, { templateId: 'sermon' }];
    type Option = { templateId: string };
    const options = (
      config as unknown as {
        document?: {
          newDocumentOptions?:
            Option[] | ((prev: Option[], context: unknown) => Option[]);
        };
      }
    ).document?.newDocumentOptions;
    const resolved: Option[] =
      typeof options === 'function' ? options(prev, {}) : prev;
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
