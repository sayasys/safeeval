'use client';

// Pattern composer form (Phase 3 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// sections 3.1 (name + typology) + 3.2 (components: closed-set + org-custom
// tags, each carrying a tag_source) + 4.1 (Subset semantics) + 12.3. Client
// component: pattern name with live validation, a free-form typology, a
// read-only "Subset" match-mode display, and the centerpiece -- a per-L3-group
// multi-select composer. For each of the six groups the org owner picks zero or
// more eligible tags (built-in closed-set tags plus the org's own shadow/live
// custom classifiers); selections render as removable chips with a source badge.
// At least one component across all groups is required (an empty pattern would
// match everything). Submit calls createPatternAction; on success it redirects
// to the detail view, on failure it renders the error and preserves form state.
//
// The closed-set tag lists are imported statically (closed-set-tags.ts -- pure
// data, safe in the client bundle); the org's custom classifiers arrive as props
// from the server page (customByGroup), already filtered to shadow/live.

import { useMemo, useState } from 'react';
import {
  validatePatternName,
  validateTypology,
  validatePatternForm,
  PATTERN_NAME_HELP,
  PATTERN_NAME_MAX_LENGTH,
  TYPOLOGY_HELP,
  TYPOLOGY_MAX_LENGTH,
} from './validation';
import { GROUP_ORDER, GROUP_LABELS, GROUP_HINTS, TAG_SOURCE_LABELS, TAG_SOURCE_BADGE_CLASS } from './labels';
import { CLOSED_SET_TAGS_BY_GROUP } from './closed-set-tags';
import { createPatternAction } from './actions';

// Build the eligible option list for one group: built-in closed-set tags first,
// then the org's shadow/live custom classifiers. De-duped by tag_id within the
// group (the pattern_components UNIQUE (pattern_id, group_name, tag_id) makes two
// same-named tags in one group unselectable together anyway); a built-in wins a
// name collision so the closed-set vocabulary is never shadowed.
function buildGroupOptions(group, customByGroup) {
  const seen = new Set();
  const options = [];
  for (const tag of CLOSED_SET_TAGS_BY_GROUP[group] || []) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    options.push({ tag_id: tag, tag_source: 'closed_set' });
  }
  for (const tag of (customByGroup && customByGroup[group]) || []) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    options.push({ tag_id: tag, tag_source: 'org_custom' });
  }
  return options;
}

export default function PatternComposerForm({ customByGroup = {}, existingNames = [] }) {
  const [name, setName] = useState('');
  const [typology, setTypology] = useState('');
  // selected: flat array of { group_name, tag_id, tag_source }. This IS the
  // components payload submitted to createPatternAction.
  const [selected, setSelected] = useState([]);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);

  const optionsByGroup = useMemo(
    () =>
      GROUP_ORDER.reduce((acc, group) => {
        acc[group] = buildGroupOptions(group, customByGroup);
        return acc;
      }, {}),
    [customByGroup],
  );

  const values = { name, typology, components: selected };
  const errors = useMemo(
    () => validatePatternForm(values),
    [name, typology, selected],
  );
  const formValid = Object.keys(errors).length === 0;

  // Soft collision warning (not a block -- the persistence layer enforces the
  // UNIQUE (organization_id, name) constraint on submit).
  const collision = useMemo(() => {
    if (!name) return false;
    return existingNames.some((n) => n === name);
  }, [name, existingNames]);

  const show = (field) => (touched[field] || submitted) && errors[field];
  const markTouched = (field) => setTouched((t) => ({ ...t, [field]: true }));

  const nameError = show('name') ? validatePatternName(name) : null;
  const typologyError = show('typology') ? validateTypology(typology) : null;

  function isSelected(group, tagId) {
    return selected.some((c) => c.group_name === group && c.tag_id === tagId);
  }

  function addComponent(group, tagId, tagSource) {
    if (!tagId) return;
    // De-dupe by (group, tag_id): same tag in a group can only be composed once.
    if (isSelected(group, tagId)) return;
    setSelected((cur) => [
      ...cur,
      { group_name: group, tag_id: tagId, tag_source: tagSource },
    ]);
  }

  function removeComponent(group, tagId) {
    setSelected((cur) =>
      cur.filter((c) => !(c.group_name === group && c.tag_id === tagId)),
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (!formValid) return;

    setBusy(true);
    const result = await createPatternAction({
      name,
      typology,
      components: selected,
    });
    // A successful create redirects inside the action and never returns here.
    // Reaching this line means the action returned a failure.
    if (result && result.ok === false) {
      setBusy(false);
      setServerError(result.message || 'Could not create the pattern.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* Pattern name */}
      <Field label="Pattern name" htmlFor="pattern_name" help={PATTERN_NAME_HELP} error={nameError}>
        <input
          id="pattern_name"
          type="text"
          value={name}
          maxLength={PATTERN_NAME_MAX_LENGTH}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => markTouched('name')}
          disabled={busy}
          autoComplete="off"
          placeholder="Romance-crypto cross-pollination"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:opacity-50"
        />
        {collision && !nameError && (
          <p className="mt-1 text-xs text-red-600">
            A pattern named <span className="font-medium">{name}</span> already
            exists in this organization. You can still submit, but it will be
            rejected as a duplicate -- choose a different name.
          </p>
        )}
      </Field>

      {/* Typology */}
      <Field label="Typology" htmlFor="pattern_typology" help={TYPOLOGY_HELP} error={typologyError}>
        <input
          id="pattern_typology"
          type="text"
          value={typology}
          maxLength={TYPOLOGY_MAX_LENGTH}
          onChange={(e) => setTypology(e.target.value)}
          onBlur={() => markTouched('typology')}
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
          placeholder="investment_fraud"
          className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:opacity-50"
        />
      </Field>

      {/* Match mode -- read-only in Phase 3 (Subset only; Weighted is Phase 5). */}
      <div>
        <span className="block text-sm font-medium text-slate-800">Match mode</span>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-sm font-medium text-slate-700">
            Subset
          </span>
          <span className="text-xs text-slate-500">
            Matches when every component you name is present. Weighted matching
            arrives in a later phase.
          </span>
        </div>
      </div>

      {/* Components composer -- the centerpiece. */}
      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Components</legend>
        <p className="mt-0.5 mb-1 text-xs text-slate-500">
          Pick the tags that must all be present for this pattern to match. Pick
          from any of the six L3 groups; groups you leave empty are wildcards.
        </p>
        {(submitted || touched.components) && errors.components && (
          <p role="alert" className="mb-3 text-xs text-red-600">
            {errors.components}
          </p>
        )}

        <div className="space-y-5">
          {GROUP_ORDER.map((group) => (
            <GroupComposer
              key={group}
              group={group}
              label={GROUP_LABELS[group]}
              hint={GROUP_HINTS[group]}
              options={optionsByGroup[group] || []}
              selected={selected.filter((c) => c.group_name === group)}
              onAdd={(tagId, tagSource) => {
                addComponent(group, tagId, tagSource);
                markTouched('components');
              }}
              onRemove={(tagId) => removeComponent(group, tagId)}
              busy={busy}
            />
          ))}
        </div>
      </fieldset>

      {serverError && (
        <div
          role="alert"
          className="rounded-md border border-red-400 bg-red-400/10 text-red-600 text-sm px-3 py-2"
        >
          {serverError}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Creating...' : 'Create pattern'}
        </button>
        <span className="text-xs text-slate-500">
          {selected.length} {selected.length === 1 ? 'component' : 'components'}{' '}
          selected. Lands as <span className="font-medium">active</span>.
        </span>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, help, error, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {help && <p className="mt-0.5 mb-1.5 text-xs text-slate-500">{help}</p>}
      {children}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// One L3 group's composer: a header, a hint, an "add a tag" dropdown listing the
// not-yet-selected eligible options (built-in via one optgroup, the org's custom
// classifiers via another), and the selected entries as removable chips. The
// dropdown resets to its placeholder after each add so it reads as an action,
// not a single-select.
function GroupComposer({ group, label, hint, options, selected, onAdd, onRemove, busy }) {
  const selectedIds = new Set(selected.map((c) => c.tag_id));
  const available = options.filter((o) => !selectedIds.has(o.tag_id));
  const builtIn = available.filter((o) => o.tag_source === 'closed_set');
  const custom = available.filter((o) => o.tag_source === 'org_custom');

  function handleChange(e) {
    const value = e.target.value;
    if (!value) return;
    // value encodes "<tag_source>:<tag_id>" so a custom tag that shares a name
    // with a built-in (different group) is still unambiguous.
    const sep = value.indexOf(':');
    const tagSource = value.slice(0, sep);
    const tagId = value.slice(sep + 1);
    onAdd(tagId, tagSource);
    e.target.value = '';
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/40 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        <span className="text-xs text-slate-400">{hint}</span>
      </div>

      {selected.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {selected.map((c) => (
            <li
              key={c.tag_id}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white py-1 pl-2 pr-1 text-sm"
            >
              <span className="font-mono text-slate-700">{c.tag_id}</span>
              <SourceBadge source={c.tag_source} />
              <button
                type="button"
                onClick={() => onRemove(c.tag_id)}
                disabled={busy}
                aria-label={`Remove ${c.tag_id} from ${label}`}
                className="ml-0.5 rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-40"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2">
        <label className="sr-only" htmlFor={`add-${group}`}>
          Add a {label} tag
        </label>
        <select
          id={`add-${group}`}
          defaultValue=""
          onChange={handleChange}
          disabled={busy || available.length === 0}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:opacity-50"
        >
          <option value="" disabled>
            {available.length === 0 ? 'All tags added' : `Add a ${label.toLowerCase()} tag...`}
          </option>
          {builtIn.length > 0 && (
            <optgroup label="Built-in">
              {builtIn.map((o) => (
                <option key={`closed_set:${o.tag_id}`} value={`closed_set:${o.tag_id}`}>
                  {o.tag_id}
                </option>
              ))}
            </optgroup>
          )}
          {custom.length > 0 && (
            <optgroup label="Your custom classifiers">
              {custom.map((o) => (
                <option key={`org_custom:${o.tag_id}`} value={`org_custom:${o.tag_id}`}>
                  {o.tag_id}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
    </div>
  );
}

function SourceBadge({ source }) {
  const label = TAG_SOURCE_LABELS[source] || source;
  const cls = TAG_SOURCE_BADGE_CLASS[source] || 'bg-slate-100 text-slate-600 border border-slate-200';
  return (
    <span className={`rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}
