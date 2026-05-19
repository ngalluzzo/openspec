import {
	createWorkspaceCliProgram,
	type WorkspaceCliHandlers,
} from "./generated/workspace-cli-program.generated.ts";
import { workspaceBuildAdapter, workspaceSyncAdapter } from "./index.ts";

const runtimeHandlers = {
	"workspace.build.default.run": async (opts) => {
		const policy = opts.policy as
			| "overwrite-generated"
			| "error-on-conflict"
			| undefined;
		const result = await workspaceBuildAdapter.run({
			root: opts.root ?? process.cwd(),
			environment: opts.environment,
			...(policy !== undefined ? { policy } : {}),
		});
		console.log(
			`Done (${result.written.length} written, ${result.skipped.length} skipped, ${result.stale.length} stale).`,
		);
	},
	"workspace.sync.default.run": async (opts) => {
		const preview = parseBooleanOption(opts.preview);
		const json = parseBooleanOption(opts.json);
		const result = await workspaceSyncAdapter.run({
			root: opts.root ?? process.cwd(),
			environment: opts.environment,
			preview,
			...(opts.target !== undefined ? { target: opts.target } : {}),
			json,
			forceBreaking: parseBooleanOption(opts.forceBreaking),
			yes: parseBooleanOption(opts.yes),
		});
		if (json) {
			console.log(JSON.stringify(result, null, 2));
			return;
		}
		if (preview) {
			console.log("Preview mode — no changes applied.\n");
		}
		for (const summary of result.summaries) {
			const breaking = summary.breaking > 0 ? `  ⚠ ${summary.breaking} breaking` : "";
			console.log(
				`[${summary.id}] +${summary.created} ~${summary.updated} -${summary.deleted}${breaking}`,
			);
		}
		if (result.summaries.length === 0) {
			console.log("No sync actions found.");
		} else if (!preview) {
			const total = result.summaries.reduce(
				(acc, s) => acc + s.created + s.updated + s.deleted,
				0,
			);
			console.log(`\nDone (${total} mutations applied).`);
		}
	},
} satisfies Partial<WorkspaceCliHandlers>;

createWorkspaceCliProgram(runtimeHandlers).parse();

function parseBooleanOption(value: unknown): boolean {
	return value === true || value === "true" || value === "1" || value === "yes";
}
