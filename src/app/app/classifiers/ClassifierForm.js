'use client';

// Custom L3 classifier definition form (Phase 2 UI).
//
// Spec: docs/memos/2026-05-29-custom-patterns-and-classifiers-scoping.md
// section 5 (structured definition flow). Client component: group placement,
// snake_case tag name with live validation, definition prose with a live
// character counter, and dynamic positive/negative example lists (>= 2 of each).
// Submit calls the createClassifierAction server action; on success it redirects
// to the detail view, on failure it renders the error and preserves form state.
//
// The two optional fields from the memo prose -- bright-line indicators (5.5) and
// conflicts-with (5.6) -- are surfaced as collapsed sections below the required
// fields. They were deferred in the original Phase 2 form because the schema had
// no columns for them; the M14 backfill added the columns, so they live here now.
// Both default to an empty array when the customer leaves the section untouched.

import { useMemo, useState } from 'react';
import {
  validateTagName,
  validateDefinition,
  validateExampleText,
  validateBrightLineIndicator,
  validateConflictTag,
  validateClassifierForm,
  TAG_NAME_HELP,
  BRIGHT_LINE_HELP,
  CONFLICTS_WITH_HELP,
  DEFINITION_MIN_LENGTH,
  DEFINITION_MAX_LENGTH,
  EXAMPLE_MAX_LENGTH,
  BRIGHT_LINE_MAX_LENGTH,
  MIN_EXAMPLES_PER_KIND,
} from './validation';
import { GROUP_OPTIONS } from './labels';
import { createClassifierAction } from './actions';

function emptyRows(n) {
  return Array.from({ length: n }, () => '');
}

export default function ClassifierForm({ existing = [] }) {
  const [groupName, setGroupName] = useState('');
  const [tagName, setTagName] = useState('');
  const [definition, setDefinition] = useState('');
  const [positives, setPositives] = useState(emptyRows(MIN_EXAMPLES_PER_KIND));
  const [negatives, setNegatives] = useState(emptyRows(MIN_EXAMPLES_PER_KIND));
  // Optional fields (memo 5.5 / 5.6). Start empty -- the customer opens the
  // collapsed section and adds rows only if they want them.
  const [brightLines, setBrightLines] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  // Per-field "touched" so errors appear after interaction, not on first paint.
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);

  const values = {
    group_name: groupName,
    tag_name: tagName,
    definition,
    positives,
    negatives,
    bright_line_indicators: brightLines,
    conflicts_with: conflicts,
  };
  const errors = useMemo(() => validateClassifierForm(values), [
    groupName,
    tagName,
    definition,
    positives,
    negatives,
    brightLines,
    conflicts,
  ]);
  const formValid = Object.keys(errors).length === 0;

  // Soft collision warning (not a block -- the persistence layer enforces
  // uniqueness on submit). Fires when tag_name + group_name already exist.
  const collision = useMemo(() => {
    if (!tagName || !groupName) return false;
    return existing.some(
      (c) => c.tag_name === tagName && c.group_name === groupName,
    );
  }, [tagName, groupName, existing]);

  const show = (field) => (touched[field] || submitted) && errors[field];
  const markTouched = (field) => setTouched((t) => ({ ...t, [field]: true }));

  const tagError = show('tag_name') ? validateTagName(tagName) : null;
  const defError = show('definition') ? validateDefinition(definition) : null;
  const groupError = show('group_name') ? errors.group_name : null;

  const defLen = definition.length;
  const defCounterClass =
    defLen > DEFINITION_MAX_LENGTH
      ? 'text-red-600'
      : defLen >= DEFINITION_MAX_LENGTH * 0.9
        ? 'text-red-500'
        : defLen >= DEFINITION_MAX_LENGTH * 0.75
          ? 'text-sage-600'
          : 'text-slate-400';

  function updateRow(setter, list, index, value) {
    const next = list.slice();
    next[index] = value;
    setter(next);
  }
  function addRow(setter, list) {
    setter([...list, '']);
  }
  function removeRow(setter, list, index) {
    if (list.length <= MIN_EXAMPLES_PER_KIND) return;
    setter(list.filter((_, i) => i !== index));
  }
  // Optional-list remove has no floor -- the section may go back to zero rows.
  function removeOptionalRow(setter, list, index) {
    setter(list.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (!formValid) return;

    setBusy(true);
    const result = await createClassifierAction({
      group_name: groupName,
      tag_name: tagName,
      definition,
      positives,
      negatives,
      bright_line_indicators: brightLines,
      conflicts_with: conflicts,
    });
    // A successful create redirects inside the action and never returns here.
    // Reaching this line means the action returned a failure.
    if (result && result.ok === false) {
      setBusy(false);
      setServerError(result.message || 'Could not create the classifier.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* Group placement */}
      <Field
        label="Group placement"
        htmlFor="group_name"
        help="Which closed-set L3 group this tag extends. This decides where it appears in the evaluation envelope."
        error={groupError}
      >
        <select
          id="group_name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          onBlur={() => markTouched('group_name')}
          disabled={busy}
          className="w-full rounded-md border border-sage-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400 disabled:opacity-50"
        >
          <option value="">Select a group...</option>
          {GROUP_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        {groupName && (
          <p className="mt-1 text-xs text-slate-500">
            {GROUP_OPTIONS.find((g) => g.value === groupName)?.hint}
          </p>
        )}
      </Field>

      {/* Tag name */}
      <Field
        label="Tag name"
        htmlFor="tag_name"
        help={TAG_NAME_HELP}
        error={tagError}
      >
        <input
          id="tag_name"
          type="text"
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          onBlur={() => markTouched('tag_name')}
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
          placeholder="synthetic_celebrity_endorsement"
          className="w-full rounded-md border border-sage-200 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sage-400 disabled:opacity-50"
        />
        {collision && !tagError && (
          <p className="mt-1 text-xs text-red-600">
            A classifier named <span className="font-mono">{tagName}</span> already
            exists in this group. You can still submit, but it will be rejected as a
            duplicate -- choose a different name.
          </p>
        )}
      </Field>

      {/* Definition prose */}
      <Field
        label="Definition"
        htmlFor="definition"
        help="1-3 sentences describing what this tag should match. The model will read this as reference material when classifying new inputs -- never as instructions."
        error={defError}
      >
        <textarea
          id="definition"
          rows={4}
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          onBlur={() => markTouched('definition')}
          disabled={busy}
          className="w-full rounded-md border border-sage-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400 disabled:opacity-50"
        />
        <div className="mt-1 flex justify-between text-xs">
          <span className="text-slate-400">
            {DEFINITION_MIN_LENGTH}-{DEFINITION_MAX_LENGTH} characters
          </span>
          <span className={defCounterClass}>
            {defLen}/{DEFINITION_MAX_LENGTH}
          </span>
        </div>
      </Field>

      {/* Examples */}
      <ExampleList
        legend="Positive examples"
        help={`Inputs this classifier should fire on. At least ${MIN_EXAMPLES_PER_KIND} required.`}
        rows={positives}
        onChange={(i, v) => updateRow(setPositives, positives, i, v)}
        onAdd={() => addRow(setPositives, positives)}
        onRemove={(i) => removeRow(setPositives, positives, i)}
        listError={(submitted || touched.positives) ? errors.positives : null}
        onBlur={() => markTouched('positives')}
        busy={busy}
        namePrefix="positive"
      />

      <ExampleList
        legend="Negative examples"
        help={`Inputs this classifier should NOT fire on. At least ${MIN_EXAMPLES_PER_KIND} required.`}
        rows={negatives}
        onChange={(i, v) => updateRow(setNegatives, negatives, i, v)}
        onAdd={() => addRow(setNegatives, negatives)}
        onRemove={(i) => removeRow(setNegatives, negatives, i)}
        listError={(submitted || touched.negatives) ? errors.negatives : null}
        onBlur={() => markTouched('negatives')}
        busy={busy}
        namePrefix="negative"
      />

      {/* Optional: bright-line indicators (memo 5.5) -- collapsed by default. */}
      <OptionalList
        legend="Bright-line indicators"
        help={BRIGHT_LINE_HELP}
        addLabel="+ Add bright-line indicator"
        rows={brightLines}
        onChange={(i, v) => updateRow(setBrightLines, brightLines, i, v)}
        onAdd={() => addRow(setBrightLines, brightLines)}
        onRemove={(i) => removeOptionalRow(setBrightLines, brightLines, i)}
        validateEntry={validateBrightLineIndicator}
        maxLength={BRIGHT_LINE_MAX_LENGTH}
        placeholder="trust me bro"
        mono={false}
        listError={(submitted || touched.bright_line_indicators) ? errors.bright_line_indicators : null}
        onBlur={() => markTouched('bright_line_indicators')}
        busy={busy}
        namePrefix="bright-line"
      />

      {/* Optional: conflicts-with (memo 5.6) -- collapsed by default. */}
      <OptionalList
        legend="Conflicts with"
        help={CONFLICTS_WITH_HELP}
        addLabel="+ Add conflicting tag"
        rows={conflicts}
        onChange={(i, v) => updateRow(setConflicts, conflicts, i, v)}
        onAdd={() => addRow(setConflicts, conflicts)}
        onRemove={(i) => removeOptionalRow(setConflicts, conflicts, i)}
        validateEntry={validateConflictTag}
        maxLength={40}
        placeholder="pig_butchering"
        mono
        listError={(submitted || touched.conflicts_with) ? errors.conflicts_with : null}
        onBlur={() => markTouched('conflicts_with')}
        busy={busy}
        namePrefix="conflict"
      />

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
          {busy ? 'Creating...' : 'Create classifier'}
        </button>
        <span className="text-xs text-slate-500">
          Lands as <span className="font-medium">proposed</span>. You move it to
          shadow from the detail view.
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

function ExampleList({
  legend,
  help,
  rows,
  onChange,
  onAdd,
  onRemove,
  listError,
  onBlur,
  busy,
  namePrefix,
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-800">{legend}</legend>
      <p className="mt-0.5 mb-2 text-xs text-slate-500">{help}</p>
      <div className="space-y-2">
        {rows.map((value, i) => {
          const rowError = value.trim().length > 0 ? validateExampleText(value) : null;
          return (
            <div key={`${namePrefix}-${i}`}>
              <div className="flex items-start gap-2">
                <textarea
                  rows={2}
                  value={value}
                  onChange={(e) => onChange(i, e.target.value)}
                  onBlur={onBlur}
                  disabled={busy}
                  aria-label={`${legend} ${i + 1}`}
                  className="w-full rounded-md border border-sage-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  disabled={busy || rows.length <= MIN_EXAMPLES_PER_KIND}
                  aria-label={`Remove ${legend} ${i + 1}`}
                  className="mt-1 shrink-0 rounded-md border border-sage-200 px-2 py-1 text-xs text-slate-600 hover:bg-cream-100 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
              {rowError && (
                <p className="mt-1 text-xs text-red-600">{rowError}</p>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={busy}
        className="mt-2 rounded-md border border-sage-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-cream-100 disabled:opacity-50"
      >
        Add example
      </button>
      {listError && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {listError}
        </p>
      )}
    </fieldset>
  );
}

// A collapsed-by-default optional repeatable list (memo 5.5 / 5.6). Same dynamic
// add/remove shape as ExampleList, but starts empty, can go back to zero rows,
// and uses single-line text inputs with a per-entry validator passed in.
function OptionalList({
  legend,
  help,
  addLabel,
  rows,
  onChange,
  onAdd,
  onRemove,
  validateEntry,
  maxLength,
  placeholder,
  mono,
  listError,
  onBlur,
  busy,
  namePrefix,
}) {
  return (
    <details className="rounded-md border border-sage-100 bg-cream-50/40 px-4 py-3">
      <summary className="cursor-pointer select-none text-sm font-medium text-slate-800">
        {legend} <span className="font-normal text-slate-400">(optional)</span>
      </summary>
      <p className="mt-2 mb-2 text-xs text-slate-500">{help}</p>
      <div className="space-y-2">
        {rows.map((value, i) => {
          const rowError = value.trim().length > 0 ? validateEntry(value) : null;
          return (
            <div key={`${namePrefix}-${i}`}>
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={value}
                  maxLength={maxLength}
                  onChange={(e) => onChange(i, e.target.value)}
                  onBlur={onBlur}
                  disabled={busy}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder={placeholder}
                  aria-label={`${legend} ${i + 1}`}
                  className={`w-full rounded-md border border-sage-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400 disabled:opacity-50${
                    mono ? ' font-mono' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  disabled={busy}
                  aria-label={`Remove ${legend} ${i + 1}`}
                  className="mt-1 shrink-0 rounded-md border border-sage-200 px-2 py-1 text-xs text-slate-600 hover:bg-cream-100 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
              {rowError && <p className="mt-1 text-xs text-red-600">{rowError}</p>}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={busy}
        className="mt-2 rounded-md border border-sage-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-cream-100 disabled:opacity-50"
      >
        {addLabel}
      </button>
      {listError && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {listError}
        </p>
      )}
    </details>
  );
}
