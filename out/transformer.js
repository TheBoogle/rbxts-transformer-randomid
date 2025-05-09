"use strict";
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransformContext = void 0;
var typescript_1 = __importDefault(require("typescript"));
var crypto_1 = __importDefault(require("crypto"));
var TransformContext = /** @class */ (function () {
    function TransformContext(program, context, config) {
        this.program = program;
        this.context = context;
        this.config = config;
        this.EnumMemberUUIDs = new Map();
        this.factory = context.factory;
    }
    TransformContext.prototype.transform = function (node) {
        var _this = this;
        return typescript_1.default.visitEachChild(node, function (node) { return visitNode(_this, node); }, this.context);
    };
    return TransformContext;
}());
exports.TransformContext = TransformContext;
/**
 * Visits each node and applies necessary transforms.
 */
function visitNode(context, node) {
    if (typescript_1.default.isExpression(node)) {
        return visitExpression(context, node);
    }
    return context.transform(node);
}
/**
 * Transforms:
 * - $id() → a new UUID per call
 * - Enum.Member → assigned UUID (lazily generated)
 */
function visitExpression(context, node) {
    var factory = context.factory;
    // $id() → new UUID
    if (typescript_1.default.isCallExpression(node)) {
        var expression = node.expression;
        if (typescript_1.default.isIdentifier(expression) && expression.text === "$id") {
            return factory.createStringLiteral(crypto_1.default.randomUUID());
        }
    }
    // Enum.Member → "uuid"
    if (typescript_1.default.isPropertyAccessExpression(node)) {
        var checker = context.program.getTypeChecker();
        var memberSymbol = checker.getSymbolAtLocation(node.name);
        var enumSymbol = checker.getSymbolAtLocation(node.expression);
        if (memberSymbol && enumSymbol && isUuidEnum(enumSymbol)) {
            var uuid = getOrCreateUuid(context, memberSymbol);
            // Force a replacement node every time, even if UUID hasn't changed
            return factory.createStringLiteral(uuid);
        }
    }
    return context.transform(node);
}
/**
 * Returns true if the enum declaration has a @uuid JSDoc tag.
 */
function isUuidEnum(symbol) {
    var e_1, _a;
    var declarations = symbol.getDeclarations();
    if (!declarations)
        return false;
    try {
        for (var declarations_1 = __values(declarations), declarations_1_1 = declarations_1.next(); !declarations_1_1.done; declarations_1_1 = declarations_1.next()) {
            var decl = declarations_1_1.value;
            if (typescript_1.default.isEnumDeclaration(decl)) {
                var tags = typescript_1.default.getJSDocTags(decl);
                if (tags.some(function (tag) { return tag.tagName.text === "uuid"; })) {
                    return true;
                }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (declarations_1_1 && !declarations_1_1.done && (_a = declarations_1.return)) _a.call(declarations_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return false;
}
/**
 * Returns the existing UUID for this member, or assigns a new one.
 */
function getOrCreateUuid(context, symbol) {
    var existing = context.EnumMemberUUIDs.get(symbol);
    if (!existing) {
        existing = crypto_1.default.randomUUID();
        context.EnumMemberUUIDs.set(symbol, existing);
    }
    return existing;
}
/**
 * Transformer entry point.
 */
function transformer(program, config) {
    return function (context) {
        var transformContext = new TransformContext(program, context, config);
        return function (file) {
            var transformed = transformContext.transform(file);
            // Touch: update with no-op to ensure emit
            return typescript_1.default.factory.updateSourceFile(transformed, __spreadArray([], __read(transformed.statements), false), true);
        };
    };
}
