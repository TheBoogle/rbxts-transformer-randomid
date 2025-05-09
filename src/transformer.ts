import ts from "typescript";

/**
 * This is the transformer's configuration, the values are passed from the tsconfig.
 */
export interface TransformerConfig {
	_: void;
}

/**
 * Utility context object to hold references.
 */
export class TransformContext {
	public factory: ts.NodeFactory;

	constructor(
		public program: ts.Program,
		public context: ts.TransformationContext,
		public config: TransformerConfig,
	) {
		this.factory = context.factory;
	}

	/**
	 * Recursively transforms the children of a node.
	 */
	transform<T extends ts.Node>(node: T): T {
		return ts.visitEachChild(node, (node) => visitNode(this, node), this.context);
	}
}

/**
 * Visit a node and determine if we want to transform it.
 */
function visitNode(context: TransformContext, node: ts.Node): ts.Node {
	if (ts.isExpression(node)) {
		return visitExpression(context, node);
	}

	return context.transform(node);
}

/**
 * Transforms `$id()` calls into string literals containing UUIDs.
 */
function visitExpression(context: TransformContext, node: ts.Expression): ts.Expression {
	if (ts.isCallExpression(node)) {
		const expression = node.expression;

		if (ts.isIdentifier(expression) && expression.text === "$id") {
			const uuid = crypto.randomUUID(); // Requires Node 15.6+
			return context.factory.createStringLiteral(uuid);
		}
	}

	return context.transform(node);
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
