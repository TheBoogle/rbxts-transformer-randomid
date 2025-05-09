"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransformContext = void 0;
exports.default = transformer;
var typescript_1 = __importDefault(require("typescript"));
/**
 * Utility context object to hold references.
 */
var TransformContext = /** @class */ (function () {
    function TransformContext(program, context, config) {
        this.program = program;
        this.context = context;
        this.config = config;
        this.factory = context.factory;
    }
    /**
     * Recursively transforms the children of a node.
     */
    TransformContext.prototype.transform = function (node) {
        var _this = this;
        return typescript_1.default.visitEachChild(node, function (node) { return visitNode(_this, node); }, this.context);
    };
    return TransformContext;
}());
exports.TransformContext = TransformContext;
/**
 * Visit a node and determine if we want to transform it.
 */
function visitNode(context, node) {
    if (typescript_1.default.isExpression(node)) {
        return visitExpression(context, node);
    }
    return context.transform(node);
}
/**
 * Transforms `$id()` calls into string literals containing UUIDs.
 */
function visitExpression(context, node) {
    if (typescript_1.default.isCallExpression(node)) {
        var expression = node.expression;
        if (typescript_1.default.isIdentifier(expression) && expression.text === "$id") {
            var uuid = crypto.randomUUID(); // Requires Node 15.6+
            return context.factory.createStringLiteral(uuid);
        }
    }
    return context.transform(node);
}
/**
 * Entry point for the transformer.
 */
function transformer(program, config) {
    return function (context) {
        var transformContext = new TransformContext(program, context, config);
        return function (file) { return transformContext.transform(file); };
    };
}
