import { describe, expect, test } from "bun:test";
import { drizzleSyntaxRenderAdapter } from "../src/index.ts";

describe("drizzle syntax renderer", () => {
	test("renders Drizzle syntax facets into a TypeScript schema file recipe", async () => {
		const recipe = await drizzleSyntaxRenderAdapter.render({
			unit: {
				id: "crm.storage",
				role: "storage.schema.surface",
			},
			asset: {
				locator: { kind: "file", path: "docs/generated/crm.drizzle.ts" },
				mediaType: "text/x.typescript",
				disposition: "generated",
			},
			tables: [
				{
					id: "drizzle.table:account",
					unit: "syntax.unit:crm.storage",
					storageEntity: "storage.entity:account",
					name: "Account",
					columns: [
						{
							id: "drizzle.column:account.id",
							unit: "syntax.unit:crm.storage",
							table: "storage.entity:account",
							storageField: "storage.field:account.id",
							name: "id",
							type: "text",
							nullable: false,
							identity: true,
							unique: true,
						},
						{
							id: "drizzle.column:account.name",
							unit: "syntax.unit:crm.storage",
							table: "storage.entity:account",
							storageField: "storage.field:account.name",
							name: "name",
							type: "text",
							nullable: false,
							identity: false,
							unique: false,
						},
					],
				},
				{
					id: "drizzle.table:contact",
					unit: "syntax.unit:crm.storage",
					storageEntity: "storage.entity:contact",
					name: "Contact",
					columns: [
						{
							id: "drizzle.column:contact.id",
							unit: "syntax.unit:crm.storage",
							table: "storage.entity:contact",
							storageField: "storage.field:contact.id",
							name: "id",
							type: "text",
							nullable: false,
							identity: true,
							unique: true,
						},
					],
				},
			],
			relations: [
				{
					id: "drizzle.relation:account-contact",
					unit: "syntax.unit:crm.storage",
					storageRelation: "storage.relation:account-contact",
					name: "contacts",
					from: "storage.entity:account",
					to: "storage.entity:contact",
					cardinality: "one-to-many",
					required: false,
				},
			],
		});

		expect(recipe).toEqual({
			kind: "text.file",
			path: "docs/generated/crm.drizzle.ts",
			mediaType: "text/x.typescript",
			disposition: "generated",
			text: [
				'import { pgTable, text } from "drizzle-orm/pg-core";',
				"",
				'export const account = pgTable("account", {',
				'  id: text("id").primaryKey().notNull(),',
				'  name: text("name").notNull(),',
				'  contactsId: text("contacts_id").references(() => contact.id),',
				"});",
				"",
				'export const contact = pgTable("contact", {',
				'  id: text("id").primaryKey().notNull(),',
				"});",
				"",
			].join("\n"),
		});
	});
});
