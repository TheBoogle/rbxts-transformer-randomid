import ts from "typescript";
import crypto from "crypto";

export interface TransformerConfig {
	_: void;
}

export class TransformContext {
	public factory: ts.NodeFactory;
	public readonly EnumUUIDMap = new Map<ts.Symbol, Map<string, string>>();

	constructor(
		public program: ts.Program,
		public context: ts.TransformationContext,
		public config: TransformerConfig,
	) {
		this.factory = context.factory;
		this.collectUuidEnums();
	}

	transform<T extends ts.Node>(node: T): T {
		return ts.visitEachChild(node, (child) => visitNode(this, child), this.context);
	}

	private collectUuidEnums() {
		const checker = this.program.getTypeChecker();

		for (const sourceFile of this.program.getSourceFiles()) {
			ts.forEachChild(sourceFile, (node) => {
				if (!ts.isEnumDeclaration(node)) return;

				const hasUuid = ts.getJSDocTags(node).some((tag) => tag.tagName.text === "uuid");
				if (!hasUuid) return;

				const symbol = checker.getSymbolAtLocation(node.name);
				if (!symbol) return;

				const memberMap = new Map<string, string>();
				for (const member of node.members) {
					const name = member.name.getText();
					memberMap.set(name, crypto.randomUUID());
				}

				this.EnumUUIDMap.set(symbol, memberMap);
			});
		}
	}
}

function visitNode(context: TransformContext, node: ts.Node): ts.Node {
	if (!ts.isEnumDeclaration(node)) return context.transform(node);

	const checker = context.program.getTypeChecker();
	const symbol = checker.getSymbolAtLocation(node.name);
	if (!symbol) return node;

	const uuidMap = context.EnumUUIDMap.get(symbol);
	if (!uuidMap) return node;

	const { factory } = context;

	const newMembers = node.members.map((member) => {
		const name = member.name;
		const key = name.getText();
		const uuid = uuidMap.get(key)!;

		return factory.updateEnumMember(member, name, factory.createStringLiteral(uuid));
	});

	// Preserve modifiers (declare, const, etc.)
	const originalModifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;

	return factory.updateEnumDeclaration(node, originalModifiers, node.name, newMembers);
}

/**
 * Entry point for the transformer.
 */
export default function transformer(
	program: ts.Program,
	config: TransformerConfig,
): ts.TransformerFactory<ts.SourceFile> {
	return (context: ts.TransformationContext) => {
		const transformContext = new TransformContext(program, context, config);
		return (file: ts.SourceFile) => transformContext.transform(file);
	};
}
