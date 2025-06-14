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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransformContext = void 0;
exports.default = transformer;
var typescript_1 = __importDefault(require("typescript"));
var crypto_1 = __importDefault(require("crypto"));
var TransformContext = /** @class */ (function () {
    function TransformContext(program, context, config) {
        this.program = program;
        this.context = context;
        this.config = config;
        this.EnumUUIDMap = new Map();
        this.factory = context.factory;
        this.collectUuidEnums();
    }
    TransformContext.prototype.transform = function (node) {
        var _this = this;
        return typescript_1.default.visitEachChild(node, function (child) { return visitNode(_this, child); }, this.context);
    };
    TransformContext.prototype.collectUuidEnums = function () {
        var e_1, _a;
        var _this = this;
        var checker = this.program.getTypeChecker();
        try {
            for (var _b = __values(this.program.getSourceFiles()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var sourceFile = _c.value;
                typescript_1.default.forEachChild(sourceFile, function (node) {
                    var e_2, _a;
                    if (!typescript_1.default.isEnumDeclaration(node))
                        return;
                    var hasUuid = typescript_1.default.getJSDocTags(node).some(function (tag) { return tag.tagName.text === "uuid"; });
                    if (!hasUuid)
                        return;
                    var symbol = checker.getSymbolAtLocation(node.name);
                    if (!symbol)
                        return;
                    var memberMap = new Map();
                    try {
                        for (var _b = (e_2 = void 0, __values(node.members)), _c = _b.next(); !_c.done; _c = _b.next()) {
                            var member = _c.value;
                            var name_1 = member.name.getText();
                            memberMap.set(name_1, crypto_1.default.randomUUID());
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    _this.EnumUUIDMap.set(symbol, memberMap);
                });
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    };
    return TransformContext;
}());
exports.TransformContext = TransformContext;
function visitNode(context, node) {
    if (!typescript_1.default.isEnumDeclaration(node))
        return context.transform(node);
    var checker = context.program.getTypeChecker();
    var symbol = checker.getSymbolAtLocation(node.name);
    if (!symbol)
        return node;
    var uuidMap = context.EnumUUIDMap.get(symbol);
    if (!uuidMap)
        return node;
    var factory = context.factory;
    var newMembers = node.members.map(function (member) {
        var name = member.name;
        var key = name.getText();
        var uuid = uuidMap.get(key);
        return factory.updateEnumMember(member, name, factory.createStringLiteral(uuid));
    });
    // Preserve modifiers (declare, const, etc.)
    var originalModifiers = typescript_1.default.canHaveModifiers(node) ? typescript_1.default.getModifiers(node) : undefined;
    return factory.updateEnumDeclaration(node, originalModifiers, node.name, newMembers);
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
