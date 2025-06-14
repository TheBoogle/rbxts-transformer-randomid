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
			if (!sourceFile.fileName.endsWith(".d.ts")) continue;

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

function visitExpression(context: TransformContext, node: ts.Expression): ts.Expression {
	const { factory, program, EnumUUIDMap } = context;

	if (ts.isPropertyAccessExpression(node)) {
		const checker = program.getTypeChecker();

		const enumSymbol = checker.getSymbolAtLocation(node.expression);
		if (!enumSymbol) return context.transform(node);

		const uuidMap = EnumUUIDMap.get(enumSymbol);
		if (!uuidMap) return context.transform(node);

		const memberName = node.name.getText();
		const uuid = uuidMap.get(memberName);
		if (!uuid) return context.transform(node);

		const enumFullName = node.getText();
		const enumType = factory.createTypeReferenceNode(enumFullName, undefined);

		const castToUnknown = factory.createAsExpression(
			factory.createStringLiteral(uuid),
			factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
		);
		return factory.createAsExpression(castToUnknown, enumType);
	}

	return context.transform(node);
}

function visitNode(context: TransformContext, node: ts.Node): ts.Node {
	if (ts.isExpression(node)) {
		return visitExpression(context, node);
	}

	if (ts.isEnumDeclaration(node)) {
		const checker = context.program.getTypeChecker();
		const symbol = checker.getSymbolAtLocation(node.name);
		if (!symbol) return node;

		const uuidMap = context.EnumUUIDMap.get(symbol);
		if (!uuidMap) return node;

		const { factory } = context;
		const newMembers = node.members.map((member) => {
			const name = member.name;
			const uuid = uuidMap.get(name.getText());
			return factory.updateEnumMember(member, name, factory.createStringLiteral(uuid!));
		});

		return factory.updateEnumDeclaration(node, ts.getModifiers(node), node.name, newMembers);
	}

	return context.transform(node);
}

export default function transformer(
	program: ts.Program,
	config: TransformerConfig,
): ts.TransformerFactory<ts.SourceFile> {
	return (context: ts.TransformationContext) => {
		const transformContext = new TransformContext(program, context, config);
		return (file: ts.SourceFile) => {
			const result = transformContext.transform(file);
			return ts.factory.updateSourceFile(result, [...result.statements], true);
		};
	};
}
