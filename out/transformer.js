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
        var _loop_1 = function (sourceFile) {
            if (sourceFile.isDeclarationFile || sourceFile.fileName.endsWith(".d.ts")) {
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
                    typescript_1.default.sys.write("[UUID] Found enum: ".concat(node.name.getText(), " in ").concat(sourceFile.fileName, "\n"));
                    var memberMap = new Map();
                    try {
                        for (var _b = (e_2 = void 0, __values(node.members)), _c = _b.next(); !_c.done; _c = _b.next()) {
                            var member = _c.value;
                            var name_1 = member.name.getText();
                            var uuid = crypto_1.default.randomUUID();
                            memberMap.set(name_1, uuid);
                            typescript_1.default.sys.write(" - ".concat(name_1, " \u2192 ").concat(uuid, "\n"));
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
        };
        try {
            for (var _b = __values(this.program.getSourceFiles()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var sourceFile = _c.value;
                _loop_1(sourceFile);
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
function visitExpression(context, node) {
    var factory = context.factory, program = context.program, EnumUUIDMap = context.EnumUUIDMap;
    if (typescript_1.default.isPropertyAccessExpression(node)) {
        var checker = program.getTypeChecker();
        var enumSymbol = checker.getSymbolAtLocation(node.expression);
        if (!enumSymbol)
            return context.transform(node);
        var uuidMap = EnumUUIDMap.get(enumSymbol);
        if (!uuidMap)
            return context.transform(node);
        var memberName = node.name.getText();
        var uuid = uuidMap.get(memberName);
        if (!uuid)
            return context.transform(node);
        // Use the full enum member as a type reference, e.g., EMonkeyPacketType.HealthSync
        var enumFullName = node.getText();
        var enumType = factory.createTypeReferenceNode(enumFullName, undefined);
        // Cast like: "uuid" as unknown as Enum.Member
        var castToUnknown = factory.createAsExpression(factory.createStringLiteral(uuid), factory.createKeywordTypeNode(typescript_1.default.SyntaxKind.UnknownKeyword));
        var finalCast = factory.createAsExpression(castToUnknown, enumType);
        return finalCast;
    }
    return context.transform(node);
}
function visitNode(context, node) {
    if (typescript_1.default.isExpression(node)) {
        return visitExpression(context, node);
    }
    if (!typescript_1.default.isEnumDeclaration(node))
        return context.transform(node);
    var checker = context.program.getTypeChecker();
    var symbol = checker.getSymbolAtLocation(node.name);
    if (!symbol) {
        typescript_1.default.sys.write("[UUID] No symbol for enum: ".concat(node.name.getText(), "\n"));
        return node;
    }
    var uuidMap = context.EnumUUIDMap.get(symbol);
    if (!uuidMap) {
        typescript_1.default.sys.write("[UUID] Enum not in map (probably missing @uuid): ".concat(node.name.getText(), "\n"));
        return node;
    }
    var factory = context.factory;
    var newMembers = node.members.map(function (member) {
        var name = member.name;
        var key = name.getText();
        var uuid = uuidMap.get(key);
        return factory.updateEnumMember(member, name, factory.createStringLiteral(uuid));
    });
    var originalModifiers = typescript_1.default.canHaveModifiers(node) ? typescript_1.default.getModifiers(node) : undefined;
    typescript_1.default.sys.write("[UUID] Rewriting enum: ".concat(node.name.getText(), "\n"));
    return factory.updateEnumDeclaration(node, originalModifiers, node.name, newMembers);
}
/**
 * Transformer entry point.
 */
function transformer(program, config) {
    return function (context) {
        var transformContext = new TransformContext(program, context, config);
        return function (file) {
            var result = transformContext.transform(file);
            // Force emit
            return typescript_1.default.factory.updateSourceFile(result, __spreadArray([], __read(result.statements), false), true);
        };
    };
}
