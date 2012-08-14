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

var totalVersion = 0;
var buffer = [];

_.each(moduleList, function (module) {
    var fullName = "wind-" + module;
    var version = Wind.modules[module].version;
    var outputName = fullName + "-" + version + ".js";
    
    var content = fs.readFileSync(path.join(srcDir, fullName + ".js"), "utf8");
    fs.writeFileSync(path.join(devDir, outputName), content, "utf8");
    
    buffer.push("/***********************************************************************");
    buffer.push("  " + outputName);
    buffer.push(" ***********************************************************************/");
    buffer.push("");
    buffer.push(content);
    buffer.push("");

    var lastDot = version.lastIndexOf(".");
    totalVersion += parseInt(version.substring(lastDot + 1), 10);
    
    console.log(outputName + " generated.");
});

var windAllName = "wind-all-0.7." + totalVersion + ".js";
fs.writeFileSync(path.join(devDir, windAllName), buffer.join("\n"), "utf8");
console.log(windAllName + " generated.");