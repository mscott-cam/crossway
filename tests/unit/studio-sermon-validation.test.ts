import { describe, expect, it } from 'vitest';
import { sermon } from '../../studio/schemaTypes/sermon';
import { requiredUnlessImported } from '../../studio/schemaTypes/sermon-helpers';

type CustomFn = (value: unknown, context: { document?: unknown }) => unknown;

function customValidatorsOf(fieldName: string): CustomFn[] {
  const field = sermon.fields.find((f) => f.name === fieldName) as unknown as {
    validation: (rule: unknown) => unknown;
  };
  const captured: CustomFn[] = [];
  const rule: unknown = new Proxy(() => undefined, {
    get: (_target, prop) =>
      prop === 'custom'
        ? (fn: CustomFn) => {
            captured.push(fn);
            return rule;
          }
        : () => rule,
  });
  field.validation(rule);
  return captured;
}

const imported = { document: { webflowPath: '/sermons/old-one' } };
const brandNew = { document: { title: 'Fresh' } };

describe.each([
  ['book', 'Genesis', ''],
  ['speaker', { _type: 'reference', _ref: 'speaker-x' }, undefined],
])('sermon %s validation', (name, filled, empty) => {
  const validators = () => customValidatorsOf(name);

  it('is custom-validated', () => {
    expect(validators()).toHaveLength(1);
  });

  it('rejects an empty value on a new sermon', () => {
    const [validate] = validators();
    expect(validate(empty, brandNew)).toBe('Required');
    expect(validate(undefined, brandNew)).toBe('Required');
    expect(validate(undefined, {})).toBe('Required');
    expect(validate(null, brandNew)).toBe('Required');
  });

  it('accepts an empty value when webflowPath is set', () => {
    const [validate] = validators();
    expect(validate(empty, imported)).toBe(true);
    expect(validate(undefined, imported)).toBe(true);
  });

  it('accepts a filled value either way', () => {
    const [validate] = validators();
    expect(validate(filled, brandNew)).toBe(true);
    expect(validate(filled, imported)).toBe(true);
  });
});

describe('requiredUnlessImported', () => {
  it('treats a reference with no _ref as empty', () => {
    expect(
      requiredUnlessImported({ _type: 'reference' }, { document: {} }),
    ).toBe('Required');
  });

  it('ignores a blank webflowPath', () => {
    expect(
      requiredUnlessImported(undefined, { document: { webflowPath: '' } }),
    ).toBe('Required');
  });
});
