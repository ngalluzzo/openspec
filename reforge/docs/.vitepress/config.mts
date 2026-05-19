import { defineConfig } from "vitepress";
import type { DefaultTheme } from "vitepress/theme";

const sidebar = (): DefaultTheme.SidebarItem[] => ({
	get docs() {
		return [
			{
				text: "Getting Started",
				collapsed: false,
				items: [
					{ text: "Overview", link: "/getting-started/overview" },
					{ text: "Installation", link: "/getting-started/installation" },
					{ text: "Quick Start", link: "/getting-started/quick-start" },
				],
			},
			{
				text: "Core",
				collapsed: false,
				items: [
					{ text: "Overview", link: "/core/overview" },
					{ text: "Parsing & Printing", link: "/core/parsing-printing" },
					{ text: "Adapters", link: "/core/adapters" },
					{ text: "Comments & Gaps", link: "/core/comments-gaps" },
					{ text: "Semantic Diffing", link: "/core/semantic-diff" },
					{
						text: "API Reference",
						link: "/api/core",
					},
				],
			},
			{
				text: "Transform",
				collapsed: false,
				items: [
					{ text: "Overview", link: "/transform/overview" },
					{ text: "Queries & Selectors", link: "/transform/queries" },
					{ text: "Path API", link: "/transform/path-api" },
					{ text: "Runner", link: "/transform/runner" },
					{
						text: "API Reference",
						link: "/api/transform",
					},
				],
			},
			{
				text: "Recipes",
				collapsed: false,
				items: [
					{ text: "Overview", link: "/recipes/overview" },
					{ text: "Defining Recipes", link: "/recipes/defining-recipes" },
					{ text: "Running Recipes", link: "/recipes/running-recipes" },
					{ text: "Lint Rules", link: "/recipes/lint-rules" },
					{ text: "Templates", link: "/recipes/templates" },
					{
						text: "API Reference",
						link: "/api/recipes",
					},
				],
			},
			{
				text: "CLI",
				collapsed: false,
				items: [
					{ text: "Overview", link: "/cli/overview" },
					{ text: "Transform Files", link: "/cli/transform-files" },
				],
			},
			{
				text: "Guides",
				collapsed: false,
				items: [
					{ text: "Writing a Codemod", link: "/guides/writing-a-codemod" },
					{ text: "Building Recipes", link: "/guides/building-recipes" },
					{ text: "Custom Adapters", link: "/guides/custom-adapters" },
					{ text: "Format Preservation", link: "/guides/format-preservation" },
				],
			},
		];
	},
});

export default defineConfig({
	themeConfig: {
		siteTitle: "Reforge",
		nav: [
			{ text: "Docs", link: "/getting-started/overview" },
			{
				text: "v0.1.0",
				items: [
					{
						text: "Changelog",
						link: "https://github.com/reforgejs/reforge/releases",
					},
					{ text: "GitHub", link: "https://github.com/reforgejs/reforge" },
				],
			},
		],
		sidebar: sidebar(),
		editLink: {
			pattern: "https://github.com/reforgejs/reforge/edit/main/docs/:path",
			text: "Edit this page on GitHub",
		},
		socialLinks: [
			{ icon: "github", link: "https://github.com/reforgejs/reforge" },
		],
		footer: {
			message: "Released under the MIT License.",
			copyright: "Copyright © 2025-present reforge",
		},
	},
});
