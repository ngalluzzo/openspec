import { Command } from "commander";

export type WorkspaceBuildOptions = { root?: string; environment?: string; policy?: "overwrite-generated" | "error-on-conflict"; };

export type WorkspaceSyncOptions = { root?: string; environment?: string; preview?: string; target?: string; json?: string; forceBreaking?: string; yes?: string; };

export type WorkspaceCliHandlers = { "workspace.build.default.run": (input: WorkspaceBuildOptions) => Promise<void>; "workspace.sync.default.run": (input: WorkspaceSyncOptions) => Promise<void>; };

export function createWorkspaceCliProgram(handlers: Partial<WorkspaceCliHandlers>): Command {
	const program = new Command();
	const workspaceBuildAction = async (opts: WorkspaceBuildOptions) => {
		const handler = handlers["workspace.build.default.run"];
		if (!handler) {
			throw new Error("No CLI runtime handler registered for dispatch 'workspace.build.default.run'.");
		}
		await handler(opts);
	};
	const workspaceSyncAction = async (opts: WorkspaceSyncOptions) => {
		const handler = handlers["workspace.sync.default.run"];
		if (!handler) {
			throw new Error("No CLI runtime handler registered for dispatch 'workspace.sync.default.run'.");
		}
		await handler(opts);
	};
	program
		.name("openspec")
		.description("OpenSpec workspace CLI");
	program
		.command("build")
		.description("Build the workspace")
		.option("--root <value>", "Workspace root path")
		.option("--environment <value>", "Build environment", "default")
		.option("--policy <value>", "Overwrite policy: overwrite-generated | error-on-conflict", "overwrite-generated")
		.action(workspaceBuildAction);
	program
		.command("sync")
		.description("Sync the semantic graph to live platform targets")
		.option("--root <value>", "Workspace root path")
		.option("--environment <value>", "Build environment", "default")
		.option("--preview <value>", "Compute and display mutations without applying them", "false")
		.option("--target <value>", "Limit sync to a single sync.action id")
		.option("--json <value>", "Emit the sync report as JSON", "false")
		.option("--forceBreaking <value>", "Allow supported breaking mutations to be applied", "false")
		.option("--yes <value>", "Non-interactive confirmation flag for deliberate automation", "false")
		.action(workspaceSyncAction);
	return program;
}
