import { describe, expect, test } from "bun:test";
import { prismaSyntaxRenderAdapter } from "../src/index.ts";

describe("prisma syntax renderer", () => {
	test("renders Prisma syntax facets into a schema file recipe", async () => {
		const recipe = await prismaSyntaxRenderAdapter.render({
			unit: {
				id: "crm.storage",
				role: "storage.schema.surface",
				metadata: {
					target: {
						datasource: { provider: "postgresql", urlEnv: "DATABASE_URL" },
					},
				},
			},
			asset: {
				locator: { kind: "file", path: "docs/generated/crm.prisma" },
				mediaType: "text/x-prisma",
				disposition: "generated",
			},
			models: [
				{
					id: "prisma.model:account",
					unit: "syntax.unit:crm.storage",
					storageEntity: "storage.entity:account",
					name: "Account",
					fields: [
						{
							id: "prisma.field:account.id",
							unit: "syntax.unit:crm.storage",
							model: "storage.entity:account",
							storageField: "storage.field:account.id",
							name: "id",
							type: "String",
							nullable: false,
							identity: true,
							unique: true,
						},
						{
							id: "prisma.field:account.name",
							unit: "syntax.unit:crm.storage",
							model: "storage.entity:account",
							storageField: "storage.field:account.name",
							name: "name",
							type: "String",
							nullable: false,
							identity: false,
							unique: false,
						},
					],
				},
				{
					id: "prisma.model:contact",
					unit: "syntax.unit:crm.storage",
					storageEntity: "storage.entity:contact",
					name: "Contact",
					fields: [
						{
							id: "prisma.field:contact.id",
							unit: "syntax.unit:crm.storage",
							model: "storage.entity:contact",
							storageField: "storage.field:contact.id",
							name: "id",
							type: "String",
							nullable: false,
							identity: true,
							unique: true,
						},
					],
				},
			],
			relations: [
				{
					id: "prisma.relation:account-contact",
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
			path: "docs/generated/crm.prisma",
			mediaType: "text/x-prisma",
			disposition: "generated",
			text: [
				"generator client {",
				'  provider = "prisma-client-js"',
				"}",
				"",
				"datasource db {",
				'  provider = "postgresql"',
				'  url      = env("DATABASE_URL")',
				"}",
				"",
				"model Account {",
				"  id String @id",
				"  name String",
				"  contactsId String?",
				'  contacts Contact? @relation("Contacts", fields: [contactsId], references: [id])',
				"}",
				"",
				"model Contact {",
				"  id String @id",
				'  accountContacts Account[] @relation("Contacts")',
				"}",
				"",
			].join("\n"),
		});
	});
});
