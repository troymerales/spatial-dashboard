import { useMemo, useState, useId } from 'react';
import type { Indicator } from '../types';
import { CATEGORIES, INDICATORS } from '../data/indicators';

/**
 * Indicator browser.
 *
 * A flat select over the whole catalogue was the obvious build and the wrong
 * one: an officer looking for "immunisation dropout" should not have to scroll
 * a single alphabetical list. Grouping plus free-text search over name and
 * definition gets there in one or two keystrokes.
 *
 * Indicators that should not be painted on a map are shown but tagged, and
 * selecting one switches the page into a non-map explanation rather than
 * silently drawing something misleading.
 */
export function IndicatorPicker({
  valueId,
  onChange,
  label = 'Indicator',
  allowUnmappable = true,
  excludeId,
}: {
  valueId: string;
  onChange: (id: string) => void;
  label?: string;
  allowUnmappable?: boolean;
  excludeId?: string;
}) {
  const [query, setQuery] = useState('');
  const searchId = useId();

  const pool = useMemo(
    () =>
      INDICATORS.filter(
        (i) => (allowUnmappable || i.mappable) && (!excludeId || i.id !== excludeId),
      ),
    [allowUnmappable, excludeId],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (i: Indicator) =>
      !q ||
      i.name.toLowerCase().includes(q) ||
      i.short.toLowerCase().includes(q) ||
      i.definition.toLowerCase().includes(q);

    return CATEGORIES.map((cat) => ({
      cat,
      items: pool.filter((i) => i.category === cat.id && match(i)),
    })).filter((g) => g.items.length > 0);
  }, [pool, query]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="field">
      <label className="field__label" htmlFor={searchId}>
        {label}
      </label>
      <div className="picker__search">
        <input
          id={searchId}
          type="search"
          placeholder={`Search ${pool.length} indicators…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="picker__list" role="listbox" aria-label={label}>
        {total === 0 ? (
          <div className="picker__empty">
            Nothing matches “{query}”.
            <br />
            <button className="btn btn--subtle" onClick={() => setQuery('')} style={{ marginTop: 6 }}>
              Clear search
            </button>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.cat.id}>
              <div className="picker__group">{g.cat.label}</div>
              {g.items.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  role="option"
                  aria-selected={i.id === valueId}
                  aria-current={i.id === valueId}
                  className="picker__item"
                  onClick={() => onChange(i.id)}
                  title={i.definition}
                >
                  <span className="picker__item-row">
                    <span style={{ flex: 1, minWidth: 0 }}>{i.name}</span>
                    {!i.mappable && (
                      <span className="picker__flag picker__flag--nomap" title={i.mapNote}>
                        NOT MAPPED
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
