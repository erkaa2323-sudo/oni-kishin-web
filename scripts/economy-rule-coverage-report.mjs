const projectId = "demo-oni-economy";
const endpoint = `http://127.0.0.1:8089/emulator/v1/projects/${projectId}:ruleCoverage`;
const response = await fetch(endpoint);
if (!response.ok) throw new Error(`Rule coverage request failed: ${response.status}`);
const coverage = await response.json();

const compactMeta = (node) => {
  if (!node || typeof node !== "object" || Array.isArray(node)) return null;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "children" || key === "values" || key === "content") continue;
    if (value == null || ["string", "number", "boolean"].includes(typeof value)) {
      out[key] = value;
    } else if (typeof value === "object" && !Array.isArray(value)) {
      const small = {};
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (nestedValue == null || ["string", "number", "boolean"].includes(typeof nestedValue)) {
          small[nestedKey] = nestedValue;
        }
      }
      if (Object.keys(small).length) out[key] = small;
    }
  }
  return out;
};

const valueHasUndefined = (value) => {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some(valueHasUndefined);
  if (typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, "undefined")) return true;
  return Object.values(value).some(valueHasUndefined);
};

const report = Array.isArray(coverage.report) ? coverage.report : [];
console.log("RULE_COVERAGE_REPORT_ROOT_COUNT", report.length);
console.log(
  "RULE_COVERAGE_REPORT_ROOT_META",
  JSON.stringify(
    report.slice(0, 12).map((node, index) => ({
      index,
      meta: compactMeta(node),
      valueCount: node?.values?.length ?? 0,
      childCount: node?.children?.length ?? 0,
    })),
    null,
    2,
  ),
);

const hits = [];
const walk = (node, path, ancestors) => {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  const meta = compactMeta(node);
  const nextAncestors = [...ancestors, { path, meta }].slice(-8);
  if (
    Array.isArray(node.values) &&
    node.values.some((entry) => valueHasUndefined(entry?.value ?? entry))
  ) {
    hits.push({
      path,
      meta,
      values: node.values,
      ancestors: nextAncestors.slice(0, -1),
    });
  }
  if (Array.isArray(node.children)) {
    node.children.forEach((child, index) =>
      walk(child, `${path}.children[${index}]`, nextAncestors),
    );
  }
};

report.forEach((node, index) => walk(node, `$.report[${index}]`, []));
console.log("RULE_COVERAGE_UNDEFINED_NODE_COUNT", hits.length);
for (const [index, hit] of hits.slice(0, 80).entries()) {
  console.log(`RULE_COVERAGE_UNDEFINED_NODE_${index + 1}`, JSON.stringify(hit, null, 2));
}
console.log("RULE_COVERAGE_FOCUSED_OK");
