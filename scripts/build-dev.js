"use strict";

var path = require("path"),
    fs = require("fs"),
    utils = require("../lib/utils"),
    Jscex = utils.Jscex,
    _ = Jscex._;
    
var devDir = path.join(__dirname, "../bin/dev");
var srcDir = path.join(__dirname, "../src");

if (path.existsSync(devDir)) {
    utils.rmdirSync(devDir);
}

fs.mkdirSync(devDir);

var coreName = "jscex-" + Jscex.coreVersion + ".js"
utils.copySync(path.join(srcDir, "jscex.js"), path.join(devDir, coreName));
console.log(coreName + " generated.");

var moduleList = [ "parser", "jit", "builderbase", "async", "async-powerpack", "promise" ];
 
_.each(moduleList, function (i, module) {
    var fullName = "jscex-" + module;
    var version = Jscex.modules[module].version;
    var outputName = fullName + "-" + version + ".js";
    utils.copySync(path.join(srcDir, fullName + ".js"), path.join(devDir, outputName));
    console.log(outputName + " generated.");
});