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
			if (sourceFile.isDeclarationFile || sourceFile.fileName.endsWith(".d.ts")) {
				ts.forEachChild(sourceFile, (node) => {
					if (!ts.isEnumDeclaration(node)) return;

					const hasUuid = ts.getJSDocTags(node).some((tag) => tag.tagName.text === "uuid");
					if (!hasUuid) return;

					const symbol = checker.getSymbolAtLocation(node.name);
					if (!symbol) return;

					ts.sys.write(`[UUID] Found enum: ${node.name.getText()} in ${sourceFile.fileName}\n`);

					const memberMap = new Map<string, string>();
					for (const member of node.members) {
						const name = member.name.getText();
						const uuid = crypto.randomUUID();
						memberMap.set(name, uuid);
						ts.sys.write(` - ${name} → ${uuid}\n`);
					}

					this.EnumUUIDMap.set(symbol, memberMap);
				});
			}
		}
	}
}

function visitExpression(context: TransformContext, node: ts.Expression): ts.Expression {
	const { factory, program, EnumUUIDMap } = context;
	const checker = program.getTypeChecker();

	if (ts.isPropertyAccessExpression(node)) {
		const enumSymbol = checker.getSymbolAtLocation(node.expression);
		if (!enumSymbol) return context.transform(node);

		const uuidMap = EnumUUIDMap.get(enumSymbol);
		if (!uuidMap) return context.transform(node);

		const memberName = node.name.getText();
		const uuid = uuidMap.get(memberName);
		if (!uuid) return context.transform(node);

		// 🧠 Just return the literal
		return factory.createStringLiteral(uuid);
	}

	return context.transform(node);
}

function visitNode(context: TransformContext, node: ts.Node): ts.Node {
	if (ts.isExpression(node)) {
		return visitExpression(context, node);
	}

	if (!ts.isEnumDeclaration(node)) return context.transform(node);

	const checker = context.program.getTypeChecker();
	const symbol = checker.getSymbolAtLocation(node.name);
	if (!symbol) {
		ts.sys.write(`[UUID] No symbol for enum: ${node.name.getText()}\n`);
		return node;
	}

	const uuidMap = context.EnumUUIDMap.get(symbol);
	if (!uuidMap) {
		ts.sys.write(`[UUID] Enum not in map (probably missing @uuid): ${node.name.getText()}\n`);
		return node;
	}

	const { factory } = context;

	const newMembers = node.members.map((member) => {
		const name = member.name;
		const key = name.getText();
		const uuid = uuidMap.get(key)!;

		return factory.updateEnumMember(member, name, factory.createStringLiteral(uuid));
	});

	const originalModifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;

	ts.sys.write(`[UUID] Rewriting enum: ${node.name.getText()}\n`);

	return factory.updateEnumDeclaration(node, originalModifiers, node.name, newMembers);
}

/**
 * Transformer entry point.
 */
export default function transformer(
	program: ts.Program,
	config: TransformerConfig,
): ts.TransformerFactory<ts.SourceFile> {
	return (context: ts.TransformationContext) => {
		const transformContext = new TransformContext(program, context, config);
		return (file: ts.SourceFile) => {
			const result = transformContext.transform(file);
			// Force emit
			return ts.factory.updateSourceFile(result, [...result.statements], true);
		};
	};
}
