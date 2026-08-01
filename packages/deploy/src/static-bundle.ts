import fs from "node:fs";
import path from "node:path";

function exists(target: string) {
	return fs.existsSync(target);
}

export function normalizeExtractedStaticBundle(kind: "web" | "landing", targetDir: string) {
	const directIndex = path.join(targetDir, "index.html");
	if (exists(directIndex)) {
		return;
	}

	const childDirs = fs
		.readdirSync(targetDir, { withFileTypes: true })
		.filter(entry => entry.isDirectory())
		.map(entry => path.join(targetDir, entry.name));

	const candidateRoots = childDirs.filter(dir => exists(path.join(dir, "index.html")));
	if (candidateRoots.length !== 1) {
		return;
	}

	const nestedRoot = candidateRoots[0];
	for (const entry of fs.readdirSync(nestedRoot)) {
		fs.cpSync(path.join(nestedRoot, entry), path.join(targetDir, entry), { recursive: true });
	}
	fs.rmSync(nestedRoot, { recursive: true, force: true });
}

export function validateStaticBundle(kind: "web" | "landing", targetDir: string) {
	if (exists(path.join(targetDir, "index.html"))) {
		return;
	}

	const entries = exists(targetDir) ? fs.readdirSync(targetDir).slice(0, 20).join(", ") : "";
	throw new Error(
		`Invalid ${kind} static bundle at ${targetDir}: missing index.html${entries ? `. Found: ${entries}` : ""}`,
	);
}
