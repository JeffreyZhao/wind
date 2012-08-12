"use strict";

var path = require("path"),
    fs = require("fs"),
    utils = require("../lib/utils"),
    Wind = utils.Wind,
    _ = Wind._;
    
var devDir = path.join(__dirname, "../bin/dev");
var srcDir = path.join(__dirname, "../src");

if (fs.existsSync(devDir)) {
    utils.rmdirSync(devDir);
}

fs.mkdirSync(devDir);

var moduleList = [ "core", "compiler", "builderbase", "async", "promise" ];
 
_.each(moduleList, function (module) {
    var fullName = "wind-" + module;
    var version = Wind.modules[module].version;
    var outputName = fullName + "-" + version + ".js";
    utils.copySync(path.join(srcDir, fullName + ".js"), path.join(devDir, outputName));
    console.log(outputName + " generated.");
});