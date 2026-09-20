import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ArchetypeAuditChart } from "../src/components/portfolio/ArchetypeAuditChart";
import { MethodologyFlow } from "../src/components/portfolio/MethodologyFlow";
import { pct, titleCase } from "../src/lib/format";
import { QUESTION_IDS, QUESTION_META } from "../src/lib/portfolio/questions";
import { isPlantedProblem } from "../src/lib/portfolio/types";
import { getArchetypeAudit, getSnapshot } from "../src/server/snapshot.server";

const example = {
	archetype: "example",
	planted: 10,
	actNow: 3,
	review: 2,
	healthy: 5,
	avgNeedsAttention: 0.82,
	avgChurnSignal: 0.15,
	avgExpansionSignal: 0.97,
	avgUrgency: 2.5,
};

function renderAudit(audit) {
	return renderToStaticMarkup(createElement(ArchetypeAuditChart, { audit }));
}

test("audit bars use within-archetype counts and label each mean signal", () => {
	const html = renderAudit([example]);
	for (const width of [30, 20, 50]) {
		expect(html).toContain(`width:${width}%`);
	}
	for (const position of [82, 15, 97]) {
		expect(html).toContain(`left:${position}%`);
		expect(html).toContain(`>${position}%</span>`);
	}
	for (const label of [
		"Act now",
		"Review",
		"No action",
		"Attention",
		"Churn",
		"Expansion",
	]) {
		expect(html).toContain(`>${label}</dt>`);
	}
	expect(html).toContain("<figure");
	expect(html).toContain("<figcaption");
	expect(html).toContain("not measured churn rates or evidence of calibration");
});

test("empty audit groups and endpoint signals produce finite chart positions", () => {
	const html = renderAudit([
		{
			...example,
			planted: 0,
			actNow: 0,
			review: 0,
			healthy: 0,
			avgNeedsAttention: 0,
			avgChurnSignal: 1,
		},
	]);
	expect(html).not.toMatch(/NaN|Infinity/);
	expect(html.match(/width:0%/g)).toHaveLength(3);
	expect(html).toContain("left:0%");
	expect(html).toContain("left:100%");
	expect(renderAudit([])).not.toMatch(/NaN|Infinity/);
});

test("baseline audit renders every archetype and its real mean outputs", () => {
	const audit = getArchetypeAudit();
	expect(audit.length).toBeGreaterThan(0);
	for (const row of audit) {
		expect(row.actNow + row.review + row.healthy).toBe(row.planted);
		const html = renderAudit([row]);
		expect(html).toContain(titleCase(row.archetype));
		for (const signal of [
			row.avgNeedsAttention,
			row.avgChurnSignal,
			row.avgExpansionSignal,
		]) {
			expect(html).toContain(`>${pct(signal)}</span>`);
		}
	}
});

test("pipeline is an ordered explanation of the actual question contract", () => {
	const html = renderToStaticMarkup(createElement(MethodologyFlow));
	expect(html).toContain("<ol");
	expect(html).toContain(`${QUESTION_IDS.length} parallel questions`);
	for (const id of QUESTION_IDS) {
		expect(html).toContain(QUESTION_META[id].label);
	}
	expect(html).toContain("Removed before sending: id + planted archetype");
	expect(html).toContain("triage.ts");
	expect(html).toContain("No more inference.");
	expect(html).not.toContain("calibrated");
});

test("home-page evaluation summary agrees with the archetype audit", () => {
	const { evaluation, bands } = getSnapshot();
	const audit = getArchetypeAudit();
	const problems = audit.filter((row) => isPlantedProblem(row.archetype));
	const quiet = audit.filter((row) => !isPlantedProblem(row.archetype));
	const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0);

	expect(evaluation.planted).toBe(sum(problems, (row) => row.planted));
	expect(evaluation.plantedSurfaced).toBe(
		sum(problems, (row) => row.actNow + row.review),
	);
	expect(evaluation.quietFlagged).toBe(
		sum(quiet, (row) => row.actNow + row.review),
	);
	// Everything flagged is either a planted problem found or a quiet account
	// flagged, so the two numbers must add up to the surfaced bands.
	expect(evaluation.plantedSurfaced + evaluation.quietFlagged).toBe(
		bands["act-now"] + bands.review,
	);
	expect(evaluation.plantedSurfaced).toBeLessThanOrEqual(evaluation.planted);
});
