"use strict";

var path = require("path"),
    fs = require("fs"),
    utils = require("../lib/utils"),
    Wind = utils.Wind,
    _ = Wind._;

var npmDir = path.join(__dirname, "../bin/npm");
var srcDir = path.join(__dirname, "../src");

if (fs.existsSync(npmDir)) {
    utils.rmdirSync(npmDir);
}

fs.mkdirSync(npmDir);

var packageBase = {
    author: "Jeffrey Zhao <jeffz@live.com> (http://zhaojie.me/)",
    homepage: "https://github.com/JeffreyZhao/wind",
    bugs: {
        "url": "https://github.com/JeffreyZhao/wind/issues",
        "email": "jeffz@live.com"
    }
};

var json2str = function (json) {
    return JSON.stringify(json, null, 4);
}

var getVersion = function () {
    var total = 0;
    
    _.each(Wind.modules, function (options) {
        var version = options.version;
        var lastDot = version.lastIndexOf(".");
        total += parseInt(version.substring(lastDot + 1), 10);
    });
    
    return "0.7." + total;
}

var buildWind = function () {
    var dir = path.join(npmDir, "wind");
    fs.mkdirSync(dir);
    
    var files = [
        "wind",
        "wind-core",
        "wind-compiler",
        "wind-builderbase",
        "wind-async",
        "wind-promise"
    ];
    
    _.each(files, function (f) {
        var filename = f + ".js";
        utils.copySync(path.join(srcDir, filename), path.join(dir, filename));
    });
    
    
    var packageData = _.clone(packageBase);
    packageData.name = "wind";
    packageData.version = getVersion();
    packageData.main = "wind.js";
    packageData.description = "Wind.js is an advanced library which enable us to control flow with plain JavaScript for asynchronous programming (and more) without additional pre-compiling steps.";
    fs.writeFileSync(path.join(dir, "package.json"), json2str(packageData), "utf8");
    
    console.log("wind generated.");
}

var buildWindC = function () {
    var dir = path.join(npmDir, "windc");
    fs.mkdirSync(dir);

    utils.copySync(path.join(srcDir, "windc.js"), path.join(dir, "windc.js"));
    
    var packageData = _.clone(packageBase);
    packageData.name = "windc";
    packageData.version = "0.7.1";
    packageData.main = "windc.js";
    packageData.description = "The AOT compiler for Wind.js";
    packageData.dependencies = {
        "wind": "~0.7.1",
        "optimist": "*",
        "esprima": "*"
    };
    
    var packageContent = json2str(packageData);
    fs.writeFileSync(path.join(dir, "package.json"), packageContent, "utf8");
    
    console.log("windc generated.");
}

buildWind();

buildWindC();
