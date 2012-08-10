"use strict";

var path = require("path"),
    fs = require("fs"),
    utils = require("../lib/utils"),
    Wind = utils.Wind,
    _ = Wind._;
    
var devDir = path.join(__dirname, "../bin/dev");
var srcDir = path.join(__dirname, "../src");

if (path.existsSync(devDir)) {
    utils.rmdirSync(devDir);
}

fs.mkdirSync(devDir);

var coreName = "wind-" + Wind.coreVersion + ".js"
utils.copySync(path.join(srcDir, "wind.js"), path.join(devDir, coreName));
console.log(coreName + " generated.");

var moduleList = [ "compiler", "builderbase", "async", "async-powerpack", "promise" ];
 
_.each(moduleList, function (i, module) {
    var fullName = "wind-" + module;
    var version = Wind.modules[module].version;
    var outputName = fullName + "-" + version + ".js";
    utils.copySync(path.join(srcDir, fullName + ".js"), path.join(devDir, outputName));
    console.log(outputName + " generated.");
});