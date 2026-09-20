import { afterEach, expect, test } from "bun:test";
import {
	chmod,
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "..");
const fixtures = [];

afterEach(async () => {
	await Promise.all(
		fixtures
			.splice(0)
			.map((fixture) => rm(fixture, { force: true, recursive: true })),
	);
});

async function createFixture() {
	const fixture = await mkdtemp(join(tmpdir(), "who-needs-you-hooks-"));
	fixtures.push(fixture);
	return fixture;
}

async function createMockBun(fixture) {
	const binDirectory = join(fixture, "bin");
	const logPath = join(fixture, "bun.log");
	await mkdir(binDirectory);
	await writeFile(
		join(binDirectory, "bun"),
		`#!/bin/sh
printf '%s\\n' "$*" >> "$HOOK_LOG"
if [ "$*" = "$FAIL_COMMAND" ]; then
	exit 17
fi
`,
	);
	await chmod(join(binDirectory, "bun"), 0o755);
	return { binDirectory, logPath };
}

function run(command, cwd, environment = {}) {
	return Bun.spawnSync({
		cmd: command,
		cwd,
		env: { ...process.env, ...environment },
		stderr: "pipe",
		stdout: "pipe",
	});
}

test("pre-commit runs the full Biome check and typecheck", async () => {
	const fixture = await createFixture();
	const { binDirectory, logPath } = await createMockBun(fixture);

	const result = run(
		["sh", resolve(repositoryRoot, ".githooks/pre-commit")],
		fixture,
		{
			HOOK_LOG: logPath,
			PATH: `${binDirectory}:${process.env.PATH}`,
		},
	);

	expect(result.exitCode).toBe(0);
	expect(await readFile(logPath, "utf8")).toBe("run check\nrun typecheck\n");
});

test("pre-commit fails closed when the Biome check fails", async () => {
	const fixture = await createFixture();
	const { binDirectory, logPath } = await createMockBun(fixture);

	const result = run(
		["sh", resolve(repositoryRoot, ".githooks/pre-commit")],
		fixture,
		{
			FAIL_COMMAND: "run check",
			HOOK_LOG: logPath,
			PATH: `${binDirectory}:${process.env.PATH}`,
		},
	);

	expect(result.exitCode).toBe(17);
	expect(await readFile(logPath, "utf8")).toBe("run check\n");
});

test("pre-commit fails closed when typecheck fails", async () => {
	const fixture = await createFixture();
	const { binDirectory, logPath } = await createMockBun(fixture);

	const result = run(
		["sh", resolve(repositoryRoot, ".githooks/pre-commit")],
		fixture,
		{
			FAIL_COMMAND: "run typecheck",
			HOOK_LOG: logPath,
			PATH: `${binDirectory}:${process.env.PATH}`,
		},
	);

	expect(result.exitCode).toBe(17);
	expect(await readFile(logPath, "utf8")).toBe("run check\nrun typecheck\n");
});

async function createGitFixture() {
	const fixture = await createFixture();
	await mkdir(join(fixture, ".githooks"));
	await mkdir(join(fixture, "scripts"));
	await copyFile(
		resolve(repositoryRoot, ".githooks/pre-commit"),
		join(fixture, ".githooks/pre-commit"),
	);
	await copyFile(
		resolve(repositoryRoot, "scripts/install-git-hooks.sh"),
		join(fixture, "scripts/install-git-hooks.sh"),
	);
	await chmod(join(fixture, ".githooks/pre-commit"), 0o755);

	const result = run(["git", "init", "--quiet"], fixture, {
		GIT_CONFIG_NOSYSTEM: "1",
		HOME: fixture,
	});
	expect(result.exitCode).toBe(0);
	return fixture;
}

test("hook installer configures an unconfigured Git worktree", async () => {
	const fixture = await createGitFixture();
	const environment = { GIT_CONFIG_NOSYSTEM: "1", HOME: fixture };

	const install = run(
		["sh", "scripts/install-git-hooks.sh"],
		fixture,
		environment,
	);
	const configuredPath = run(
		["git", "config", "--local", "--get", "core.hooksPath"],
		fixture,
		environment,
	);

	expect(install.exitCode).toBe(0);
	expect(new TextDecoder().decode(configuredPath.stdout).trim()).toBe(
		".githooks",
	);
});

test("hook installer preserves an unrelated hooks path", async () => {
	const fixture = await createGitFixture();
	const environment = { GIT_CONFIG_NOSYSTEM: "1", HOME: fixture };
	run(
		["git", "config", "--local", "core.hooksPath", "custom-hooks"],
		fixture,
		environment,
	);

	const install = run(
		["sh", "scripts/install-git-hooks.sh"],
		fixture,
		environment,
	);
	const configuredPath = run(
		["git", "config", "--local", "--get", "core.hooksPath"],
		fixture,
		environment,
	);

	expect(install.exitCode).toBe(1);
	expect(new TextDecoder().decode(configuredPath.stdout).trim()).toBe(
		"custom-hooks",
	);
});
