import ts from "typescript";
import crypto from "crypto";

export interface TransformerConfig {
	_: void;
}

export class TransformContext {
	public factory: ts.NodeFactory;
	public readonly EnumMemberUUIDs = new Map<ts.Symbol, string>();

	constructor(
		public program: ts.Program,
		public context: ts.TransformationContext,
		public config: TransformerConfig,
	) {
		this.factory = context.factory;
	}

	transform<T extends ts.Node>(node: T): T {
		return ts.visitEachChild(node, (node) => visitNode(this, node), this.context);
	}
}

/**
 * Visits each node and applies necessary transforms.
 */
function visitNode(context: TransformContext, node: ts.Node): ts.Node {
	if (ts.isExpression(node)) {
		return visitExpression(context, node);
	}

	return context.transform(node);
}

/**
 * Transforms:
 * - $id() → a new UUID per call
 * - Enum.Member → assigned UUID (lazily generated)
 */
function visitExpression(context: TransformContext, node: ts.Expression): ts.Expression {
	const { factory } = context;

	// $id() → new UUID
	if (ts.isCallExpression(node)) {
		const expression = node.expression;
		if (ts.isIdentifier(expression) && expression.text === "$id") {
			return factory.createStringLiteral(crypto.randomUUID());
		}
	}

	// Enum.Member → "uuid"
	if (ts.isPropertyAccessExpression(node)) {
		const checker = context.program.getTypeChecker();
		const memberSymbol = checker.getSymbolAtLocation(node.name);
		const enumSymbol = checker.getSymbolAtLocation(node.expression);

		if (memberSymbol && enumSymbol && isUuidEnum(enumSymbol)) {
			const uuid = getOrCreateUuid(context, memberSymbol);

			// Force a replacement node every time, even if UUID hasn't changed
			return factory.createStringLiteral(uuid);
		}
	}

	return context.transform(node);
}

/**
 * Returns true if the enum declaration has a @uuid JSDoc tag.
 */
function isUuidEnum(symbol: ts.Symbol): boolean {
	const declarations = symbol.getDeclarations();
	if (!declarations) return false;

	for (const decl of declarations) {
		if (ts.isEnumDeclaration(decl)) {
			const tags = ts.getJSDocTags(decl);
			if (tags.some((tag) => tag.tagName.text === "uuid")) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Returns the existing UUID for this member, or assigns a new one.
 */
function getOrCreateUuid(context: TransformContext, symbol: ts.Symbol): string {
	let existing = context.EnumMemberUUIDs.get(symbol);
	if (!existing) {
		existing = crypto.randomUUID();
		context.EnumMemberUUIDs.set(symbol, existing);
	}
	return existing;
}

/**
 * Transformer entry point.
 */
function transformer(program: ts.Program, config: TransformerConfig): ts.TransformerFactory<ts.SourceFile> {
	return (context: ts.TransformationContext) => {
		const transformContext = new TransformContext(program, context, config);
		return (file: ts.SourceFile) => {
			const transformed = transformContext.transform(file);

			// Touch: update with no-op to ensure emit
			return ts.factory.updateSourceFile(transformed, [...transformed.statements], true);
		};
	};
}
