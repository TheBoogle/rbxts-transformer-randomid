"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
var transformer_1 = require("./transformer");
/**
 * The transformer entry point.
 * This provides access to necessary resources and the user specified configuration.
 */
function default_1(program, config) {
    return function (transformationContext) {
        var context = new transformer_1.TransformContext(program, transformationContext, config);
        return function (file) { return context.transform(file); };
    };
}
