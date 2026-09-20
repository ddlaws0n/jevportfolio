/**
 * Deterministic synthetic portfolio.
 *
 * The same seed always produces the same 1,000 accounts on the server, in the
 * browser and in the baseline script, so nothing about the portfolio itself has
 * to be shipped as data — only Jev's answers about it do.
 */

import type {
	Account,
	AccountState,
	Archetype,
	Segment,
} from "#/lib/portfolio/types";

export const DEFAULT_SEED = 42;
export const PORTFOLIO_SIZE = 1000;

/** Archetype mix. Sums to PORTFOLIO_SIZE. */
const MIX: Array<[Archetype, number]> = [
	["healthy", 620],
	["healthy_noise", 200],
	["adoption_concern", 45],
	["support_escalation", 25],
	["relationship_risk", 20],
	["renewal_risk", 25],
	["expansion_opportunity", 35],
	["ambiguous", 30],
];

// --- deterministic RNG -----------------------------------------------------

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

type Rng = () => number;

const int = (rng: Rng, min: number, max: number) =>
	Math.floor(rng() * (max - min + 1)) + min;
const pick = <T>(rng: Rng, xs: readonly T[]) =>
	xs[Math.floor(rng() * xs.length)];
const chance = (rng: Rng, p: number) => rng() < p;
const round = (n: number, dp = 0) => {
	const f = 10 ** dp;
	return Math.round(n * f) / f;
};

// --- corpora ---------------------------------------------------------------

const PREFIX = [
	"North",
	"Vertex",
	"Lumen",
	"Quant",
	"Harbor",
	"Silver",
	"Kestrel",
	"Orbit",
	"Pallas",
	"Redwood",
	"Onyx",
	"Cobalt",
	"Aster",
	"Mercia",
	"Bright",
	"Arcadia",
	"Fathom",
	"Granite",
	"Halcyon",
	"Ivory",
	"Juniper",
	"Krait",
	"Lattice",
	"Meridian",
	"Nimbus",
	"Obelisk",
	"Peregrine",
	"Quarry",
	"Ridgeline",
	"Solstice",
	"Tessera",
	"Umbra",
	"Verdant",
	"Westgate",
	"Xenon",
	"Yarrow",
	"Zephyr",
	"Beacon",
	"Cinder",
	"Dunbar",
	"Elmwood",
	"Ferrous",
	"Glasswing",
	"Hollow",
];

const SUFFIX = [
	"Labs",
	"Systems",
	"Group",
	"Holdings",
	"Digital",
	"Analytics",
	"Health",
	"Logistics",
	"Financial",
	"Retail",
	"Media",
	"Robotics",
	"Energy",
	"Partners",
	"Technologies",
	"Dynamics",
	"Networks",
	"Works",
	"Industries",
	"Capital",
	"Bioscience",
	"Freight",
	"Interactive",
	"Studios",
	"Commerce",
	"Foundry",
];

const INDUSTRIES = [
	"Financial services",
	"Healthcare",
	"Logistics",
	"Retail",
	"Manufacturing",
	"Media",
	"Public sector",
	"Energy",
	"Telecoms",
	"Professional services",
	"Education",
	"Travel",
	"Insurance",
	"Construction",
	"Gaming",
];

const COMPETITORS = ["Northbeam", "Calyx", "Provault", "Sightline", "Trellis"];

const NOTE_POOLS: Record<Archetype, readonly string[]> = {
	healthy: [
		"Quarterly business review completed on schedule; no open actions.",
		"Admin team ran an internal enablement session last month.",
		"Champion confirmed the current rollout meets their 2026 targets.",
		"Usage steady across all four departments since onboarding.",
		"Support interactions this quarter were routine how-to questions.",
	],
	healthy_noise: [
		"One team paused usage during a seasonal freeze; expected to resume.",
		"Minor billing query raised and resolved within a day.",
		"Champion was on parental leave for six weeks; cover was arranged.",
		"A single department missed its adoption target but the rest are ahead.",
		"Customer asked about our roadmap out of general interest.",
	],
	adoption_concern: [
		"Only two of the six purchased workspaces have been configured.",
		"Onboarding sessions were booked then not attended twice.",
		"Admin says the team 'hasn't had time to get into it properly yet'.",
		"Power users have moved their reporting back into spreadsheets.",
		"Requested a refresher training but has not picked a date.",
	],
	support_escalation: [
		"Sev-1 raised after a failed data sync; root cause still open.",
		"Customer escalated to their exec sponsor over response times.",
		"Three related tickets opened in the same week about export failures.",
		"Engineering fix committed but not yet scheduled for release.",
		"Customer asked for a written incident summary.",
	],
	relationship_risk: [
		"New VP is running a vendor consolidation review this quarter.",
		"Customer cancelled the last two QBRs at short notice.",
		"Our champion has left the business; no replacement introduced.",
		"Procurement requested a copy of the termination clause.",
		"Exec sponsor changed and the new sponsor has not engaged.",
	],
	renewal_risk: [
		"Finance asked for a month-to-month option instead of renewing annually.",
		"Budget holder flagged a company-wide software spend freeze.",
		"Asked how data export works ahead of the renewal date.",
		"Requested a significant discount to sign again.",
		"Comparing us against an incumbent tool already in the stack.",
	],
	expansion_opportunity: [
		"Security team wants to extend the rollout to a second region.",
		"Champion asked for enterprise pricing for an additional cohort of seats.",
		"Requested a quote for the advanced analytics module.",
		"Two adjacent teams have asked to be added to the workspace.",
		"Sponsor referenced a new budget line for next financial year.",
	],
	ambiguous: [
		"Usage is down but the customer says the team is mid-reorganisation.",
		"Large ticket open, though it is a feature request rather than an outage.",
		"CSAT is strong while login frequency has fallen noticeably.",
		"Champion is highly engaged but the wider team has gone quiet.",
		"Asked about pricing — unclear whether to expand or to cut back.",
	],
};

/**
 * Hand-authored accounts from the brief. They are spliced into fixed slots so
 * the demo always has the same inspectable, arguable cases.
 */
const HANDCRAFTED: Array<{ slot: number; account: Omit<Account, "id"> }> = [
	{
		slot: 137,
		account: {
			name: "Acme Corp",
			segment: "Enterprise",
			industry: "Manufacturing",
			arrGbp: 240_000,
			seats: 620,
			tenureMonths: 41,
			renewalInDays: 34,
			usage30dDeltaPct: -42,
			activeUsers30dDeltaPct: -37,
			featureAdoptionPct: 38,
			loginsPerSeat30d: 2.1,
			support: {
				openTickets: 4,
				sev1Last30d: 1,
				avgFirstResponseHours: 9.4,
				csat: 3.1,
			},
			engagement: {
				lastCsmMeetingDaysAgo: 41,
				qbrsCancelledLast2Q: 2,
				execSponsorChanged: true,
				championActive: false,
				npsLast: 3,
			},
			commercial: {
				seatsRequested: null,
				pricingRequested: false,
				discountRequested: false,
				competitorMentioned: "Northbeam",
				paymentIssues: false,
				multiYearDiscussed: false,
			},
			notes: [
				"New VP evaluating consolidation of vendors.",
				"Customer cancelled QBR twice.",
				"Team reports implementation remains business critical.",
			],
			archetype: "relationship_risk",
		},
	},
	{
		slot: 288,
		account: {
			name: "Globex",
			segment: "Enterprise",
			industry: "Financial services",
			arrGbp: 180_000,
			seats: 430,
			tenureMonths: 26,
			renewalInDays: 161,
			usage30dDeltaPct: 24,
			activeUsers30dDeltaPct: 31,
			featureAdoptionPct: 81,
			loginsPerSeat30d: 14.2,
			support: {
				openTickets: 1,
				sev1Last30d: 0,
				avgFirstResponseHours: 2.1,
				csat: 4.7,
			},
			engagement: {
				lastCsmMeetingDaysAgo: 8,
				qbrsCancelledLast2Q: 0,
				execSponsorChanged: false,
				championActive: true,
				npsLast: 9,
			},
			commercial: {
				seatsRequested: 500,
				pricingRequested: true,
				discountRequested: false,
				competitorMentioned: null,
				paymentIssues: false,
				multiYearDiscussed: true,
			},
			notes: [
				"Security team wants to expand rollout.",
				"Champion asked for enterprise pricing.",
			],
			archetype: "expansion_opportunity",
		},
	},
	{
		slot: 451,
		account: {
			name: "Initech",
			segment: "Mid-Market",
			industry: "Professional services",
			arrGbp: 95_000,
			seats: 180,
			tenureMonths: 19,
			renewalInDays: 73,
			usage30dDeltaPct: -18,
			activeUsers30dDeltaPct: -6,
			featureAdoptionPct: 64,
			loginsPerSeat30d: 7.8,
			support: {
				openTickets: 1,
				sev1Last30d: 0,
				avgFirstResponseHours: 3.6,
				csat: 4.6,
			},
			engagement: {
				lastCsmMeetingDaysAgo: 11,
				qbrsCancelledLast2Q: 0,
				execSponsorChanged: false,
				championActive: true,
				npsLast: 8,
			},
			commercial: {
				seatsRequested: null,
				pricingRequested: false,
				discountRequested: false,
				competitorMentioned: null,
				paymentIssues: false,
				multiYearDiscussed: false,
			},
			notes: [
				"Large support ticket open — it is a feature request, not an outage.",
				"CSAT remains strong and the champion is active weekly.",
				"Usage down 18% following a team restructure in one division.",
			],
			archetype: "ambiguous",
		},
	},
	{
		slot: 602,
		account: {
			name: "Hooli Health",
			segment: "Enterprise",
			industry: "Healthcare",
			arrGbp: 310_000,
			seats: 940,
			tenureMonths: 55,
			renewalInDays: 21,
			usage30dDeltaPct: 3,
			activeUsers30dDeltaPct: 1,
			featureAdoptionPct: 72,
			loginsPerSeat30d: 11.4,
			support: {
				openTickets: 2,
				sev1Last30d: 0,
				avgFirstResponseHours: 4.2,
				csat: 4.2,
			},
			engagement: {
				lastCsmMeetingDaysAgo: 6,
				qbrsCancelledLast2Q: 0,
				execSponsorChanged: false,
				championActive: true,
				npsLast: 7,
			},
			commercial: {
				seatsRequested: null,
				pricingRequested: false,
				discountRequested: true,
				competitorMentioned: null,
				paymentIssues: false,
				multiYearDiscussed: true,
			},
			notes: [
				"Renewal paperwork is with procurement and on track.",
				"Finance has asked for a 12% discount to sign a three-year term.",
				"Usage and sentiment are both stable.",
			],
			archetype: "healthy_noise",
		},
	},
	{
		slot: 744,
		account: {
			name: "Soylent Logistics",
			segment: "Mid-Market",
			industry: "Logistics",
			arrGbp: 88_000,
			seats: 210,
			tenureMonths: 14,
			renewalInDays: 58,
			usage30dDeltaPct: -9,
			activeUsers30dDeltaPct: -4,
			featureAdoptionPct: 29,
			loginsPerSeat30d: 3.2,
			support: {
				openTickets: 6,
				sev1Last30d: 2,
				avgFirstResponseHours: 13.8,
				csat: 2.6,
			},
			engagement: {
				lastCsmMeetingDaysAgo: 24,
				qbrsCancelledLast2Q: 1,
				execSponsorChanged: false,
				championActive: true,
				npsLast: 4,
			},
			commercial: {
				seatsRequested: null,
				pricingRequested: false,
				discountRequested: false,
				competitorMentioned: null,
				paymentIssues: true,
				multiYearDiscussed: false,
			},
			notes: [
				"Two sev-1 incidents in 30 days on the same integration.",
				"Champion is still fighting our corner internally.",
				"Last two invoices were paid late without explanation.",
			],
			archetype: "support_escalation",
		},
	},
	{
		slot: 869,
		account: {
			name: "Umbrella Retail",
			segment: "Enterprise",
			industry: "Retail",
			arrGbp: 155_000,
			seats: 510,
			tenureMonths: 31,
			renewalInDays: 118,
			usage30dDeltaPct: 41,
			activeUsers30dDeltaPct: 18,
			featureAdoptionPct: 88,
			loginsPerSeat30d: 16.9,
			support: {
				openTickets: 0,
				sev1Last30d: 0,
				avgFirstResponseHours: 1.8,
				csat: 4.9,
			},
			engagement: {
				lastCsmMeetingDaysAgo: 4,
				qbrsCancelledLast2Q: 0,
				execSponsorChanged: false,
				championActive: true,
				npsLast: 10,
			},
			commercial: {
				seatsRequested: 300,
				pricingRequested: true,
				discountRequested: false,
				competitorMentioned: null,
				paymentIssues: false,
				multiYearDiscussed: true,
			},
			notes: [
				"Two adjacent teams have asked to be added to the workspace.",
				"Sponsor referenced a new budget line for next financial year.",
				"Asked whether a multi-year agreement would unlock better rates.",
			],
			archetype: "expansion_opportunity",
		},
	},
];

// --- generation ------------------------------------------------------------

function archetypeSequence(rng: Rng): Archetype[] {
	const seq: Archetype[] = [];
	for (const [archetype, count] of MIX) {
		for (let i = 0; i < count; i++) seq.push(archetype);
	}
	// Fisher-Yates so bands are not contiguous in the grid.
	for (let i = seq.length - 1; i > 0; i--) {
		const j = int(rng, 0, i);
		[seq[i], seq[j]] = [seq[j], seq[i]];
	}
	return seq;
}

function makeName(rng: Rng, used: Set<string>): string {
	for (let attempt = 0; attempt < 40; attempt++) {
		const name = `${pick(rng, PREFIX)} ${pick(rng, SUFFIX)}`;
		if (!used.has(name)) {
			used.add(name);
			return name;
		}
	}
	let n = 2;
	let name = `${pick(rng, PREFIX)} ${pick(rng, SUFFIX)} ${n}`;
	while (used.has(name)) {
		n += 1;
		name = `${pick(rng, PREFIX)} ${pick(rng, SUFFIX)} ${n}`;
	}
	used.add(name);
	return name;
}

function notesFor(rng: Rng, archetype: Archetype): string[] {
	const pool = NOTE_POOLS[archetype];
	const count = archetype === "healthy" ? int(rng, 1, 2) : int(rng, 2, 3);
	const chosen: string[] = [];
	const seen = new Set<number>();
	while (chosen.length < count && seen.size < pool.length) {
		const i = int(rng, 0, pool.length - 1);
		if (seen.has(i)) continue;
		seen.add(i);
		chosen.push(pool[i]);
	}
	return chosen;
}

function segmentFor(rng: Rng): {
	segment: Segment;
	arrGbp: number;
	seats: number;
} {
	const roll = rng();
	if (roll < 0.14) {
		return {
			segment: "Enterprise",
			arrGbp: int(rng, 120, 420) * 1000,
			seats: int(rng, 300, 1200),
		};
	}
	if (roll < 0.52) {
		return {
			segment: "Mid-Market",
			arrGbp: int(rng, 35, 120) * 1000,
			seats: int(rng, 60, 300),
		};
	}
	return {
		segment: "SMB",
		arrGbp: int(rng, 6, 35) * 1000,
		seats: int(rng, 8, 60),
	};
}

function buildAccount(
	rng: Rng,
	archetype: Archetype,
	name: string,
): Omit<Account, "id"> {
	const { segment, arrGbp, seats } = segmentFor(rng);

	const base: Omit<Account, "id"> = {
		name,
		segment,
		industry: pick(rng, INDUSTRIES),
		arrGbp,
		seats,
		tenureMonths: int(rng, 4, 72),
		renewalInDays: int(rng, 20, 350),
		usage30dDeltaPct: int(rng, -6, 12),
		activeUsers30dDeltaPct: int(rng, -5, 10),
		featureAdoptionPct: int(rng, 55, 95),
		loginsPerSeat30d: round(6 + rng() * 12, 1),
		support: {
			openTickets: int(rng, 0, 2),
			sev1Last30d: 0,
			avgFirstResponseHours: round(1 + rng() * 5, 1),
			csat: round(4 + rng(), 1),
		},
		engagement: {
			lastCsmMeetingDaysAgo: int(rng, 3, 40),
			qbrsCancelledLast2Q: 0,
			execSponsorChanged: false,
			championActive: true,
			npsLast: int(rng, 7, 10),
		},
		commercial: {
			seatsRequested: null,
			pricingRequested: false,
			discountRequested: false,
			competitorMentioned: null,
			paymentIssues: false,
			multiYearDiscussed: false,
		},
		notes: notesFor(rng, archetype),
		archetype,
	};

	switch (archetype) {
		case "healthy":
			break;

		case "healthy_noise":
			base.usage30dDeltaPct = int(rng, -18, 14);
			base.activeUsers30dDeltaPct = int(rng, -12, 12);
			base.support.openTickets = int(rng, 0, 3);
			base.engagement.lastCsmMeetingDaysAgo = int(rng, 5, 62);
			base.engagement.npsLast = int(rng, 6, 10);
			if (chance(rng, 0.25)) base.commercial.discountRequested = true;
			break;

		case "adoption_concern":
			base.usage30dDeltaPct = int(rng, -48, -14);
			base.activeUsers30dDeltaPct = int(rng, -44, -10);
			base.featureAdoptionPct = int(rng, 12, 40);
			base.loginsPerSeat30d = round(0.6 + rng() * 3, 1);
			base.engagement.lastCsmMeetingDaysAgo = int(rng, 20, 70);
			base.engagement.npsLast = int(rng, 4, 8);
			base.support.csat = round(3.4 + rng() * 1.2, 1);
			break;

		case "support_escalation":
			base.support.openTickets = int(rng, 3, 9);
			base.support.sev1Last30d = int(rng, 1, 3);
			base.support.avgFirstResponseHours = round(7 + rng() * 14, 1);
			base.support.csat = round(1.8 + rng() * 1.4, 1);
			base.usage30dDeltaPct = int(rng, -22, 4);
			base.engagement.npsLast = int(rng, 1, 6);
			break;

		case "relationship_risk":
			base.engagement.lastCsmMeetingDaysAgo = int(rng, 38, 110);
			base.engagement.qbrsCancelledLast2Q = int(rng, 1, 2);
			base.engagement.execSponsorChanged = true;
			base.engagement.championActive = false;
			base.engagement.npsLast = chance(rng, 0.5) ? int(rng, 2, 6) : null;
			base.usage30dDeltaPct = int(rng, -26, 6);
			if (chance(rng, 0.55)) {
				base.commercial.competitorMentioned = pick(rng, COMPETITORS);
			}
			break;

		case "renewal_risk":
			base.renewalInDays = int(rng, 12, 75);
			base.commercial.discountRequested = true;
			base.commercial.competitorMentioned = pick(rng, COMPETITORS);
			base.commercial.paymentIssues = chance(rng, 0.35);
			base.usage30dDeltaPct = int(rng, -30, 5);
			base.engagement.npsLast = int(rng, 3, 7);
			base.support.csat = round(3 + rng() * 1.4, 1);
			break;

		case "expansion_opportunity":
			base.usage30dDeltaPct = int(rng, 14, 62);
			base.activeUsers30dDeltaPct = int(rng, 10, 48);
			base.featureAdoptionPct = int(rng, 72, 98);
			base.loginsPerSeat30d = round(12 + rng() * 10, 1);
			base.commercial.seatsRequested = int(rng, 3, 12) * 50;
			base.commercial.pricingRequested = true;
			base.commercial.multiYearDiscussed = chance(rng, 0.5);
			base.engagement.lastCsmMeetingDaysAgo = int(rng, 2, 16);
			base.engagement.npsLast = int(rng, 8, 10);
			break;

		case "ambiguous": {
			// Deliberately contradictory: one strong negative next to one strong
			// positive, so the interesting part is the probability, not the label.
			base.usage30dDeltaPct = int(rng, -30, -8);
			base.activeUsers30dDeltaPct = int(rng, -12, 6);
			base.featureAdoptionPct = int(rng, 48, 80);
			base.support.openTickets = int(rng, 1, 4);
			base.support.csat = round(4.2 + rng() * 0.7, 1);
			base.engagement.championActive = true;
			base.engagement.lastCsmMeetingDaysAgo = int(rng, 4, 18);
			base.engagement.npsLast = int(rng, 7, 9);
			base.renewalInDays = int(rng, 45, 120);
			if (chance(rng, 0.4)) base.commercial.pricingRequested = true;
			break;
		}
	}

	return base;
}

let cached: { seed: number; accounts: Account[] } | null = null;

/** Build (or reuse) the deterministic portfolio for a seed. */
export function generatePortfolio(seed: number = DEFAULT_SEED): Account[] {
	if (cached && cached.seed === seed) return cached.accounts;

	const rng = mulberry32(seed);
	const sequence = archetypeSequence(rng);
	const used = new Set<string>();
	const handcrafted = new Map(HANDCRAFTED.map((h) => [h.slot, h.account]));
	for (const h of HANDCRAFTED) used.add(h.account.name);

	const accounts: Account[] = sequence.map((archetype, i) => {
		const id = `ACC-${String(i + 1).padStart(4, "0")}`;
		const fixed = handcrafted.get(i);
		if (fixed) {
			// Still draw from the rng so downstream accounts stay stable.
			buildAccount(rng, archetype, makeName(rng, new Set()));
			return { id, ...fixed };
		}
		return { id, ...buildAccount(rng, archetype, makeName(rng, used)) };
	});

	cached = { seed, accounts };
	return accounts;
}

/** Strip the fields Jev must never see, then hand the rest over as `state`. */
export function toAccountState(account: Account): AccountState {
	const { archetype: _archetype, id: _id, ...state } = account;
	return state;
}
