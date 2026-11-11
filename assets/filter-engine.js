(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TicketFilterEngine = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function() {
  "use strict";

  const MAX_FILTER_VALUES = 25;
  const MAX_FILTER_FIELDS = 12;
  const SEMANTIC_HEADER = /(status|state|priority|severity|impact|urgency|category|subcategory|type|product|service|application|module|area|component|team|group|assignee|assigned|owner|environment|site|location|region|country|department|business.?unit|channel|source|queue|vendor|customer|company|resolution.?code|classification|platform|system|tower)/i;
  const IDENTIFIER_HEADER = /(^|[^a-z0-9])(id|number|sysid|guid|uuid|email|phone|mobile|url|uri|link|serial)([^a-z0-9]|$)/i;
  const DATE_HEADER = /(^|[^a-z0-9])(date|datetime|time|timestamp|created|creation|opened|reported|logged|submitted|updated|modified|resolved|closed|due|deadline|completed)([^a-z0-9]|$)/i;
  const FREE_TEXT_HEADER = /(description|summary|subject|comments?|work.?notes?|journal|long.?text|narrative|diagnostic|steps|symptoms?|attachment|message.?body|detailed.?notes?)/i;

  function isBlank(value) {
    return value === null || value === undefined || String(value).trim() === "";
  }

  function detectFilterColumns(headers, records) {
    const sourceHeaders = Array.isArray(headers) ? headers : [];
    const sourceRows = Array.isArray(records) ? records : [];
    const candidates = [];

    for (const name of sourceHeaders) {
      const header = String(name ?? "").trim();
      if (!header || IDENTIFIER_HEADER.test(header) || DATE_HEADER.test(header) || FREE_TEXT_HEADER.test(header)) continue;

      const semantic = SEMANTIC_HEADER.test(header);
      const counts = new Map();
      let nonEmpty = 0;
      let totalChars = 0;
      let longest = 0;
      let tooManyValues = false;

      for (const record of sourceRows) {
        const raw = record && Object.prototype.hasOwnProperty.call(record, header) ? record[header] : "";
        if (isBlank(raw)) continue;
        const value = String(raw).trim();
        if (!value) continue;
        nonEmpty++;
        totalChars += value.length;
        if (value.length > longest) longest = value.length;
        if (!counts.has(value)) {
          counts.set(value, 0);
          if (counts.size > MAX_FILTER_VALUES) {
            tooManyValues = true;
            break;
          }
        }
        counts.set(value, counts.get(value) + 1);
      }

      if (tooManyValues || counts.size < 2 || nonEmpty < 2) continue;
      const coverage = sourceRows.length ? nonEmpty / sourceRows.length : 0;
      const uniqueRatio = counts.size / nonEmpty;
      const averageLength = nonEmpty ? totalChars / nonEmpty : 0;

      if (coverage < 0.25 || longest > 140 || averageLength > 64) continue;
      if (semantic ? uniqueRatio > 0.75 : uniqueRatio > 0.35) continue;

      const repeatedRows = nonEmpty - counts.size;
      const score =
        (semantic ? 60 : 0) +
        coverage * 30 +
        Math.max(0, 20 - uniqueRatio * 25) +
        Math.min(repeatedRows, 100) * 0.08 -
        counts.size * 0.35;

      const options = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

      candidates.push({ name: header, options, nonEmpty, uniqueCount: counts.size, coverage, score });
    }

    candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return candidates.slice(0, MAX_FILTER_FIELDS);
  }

  function matchesFacetValues(facetValues, selections) {
    const values = facetValues || {};
    const selected = selections || {};
    return Object.keys(selected).every(name => {
      const expected = selected[name];
      return !expected || String(values[name] ?? "") === String(expected);
    });
  }

  return { detectFilterColumns, matchesFacetValues };
});
