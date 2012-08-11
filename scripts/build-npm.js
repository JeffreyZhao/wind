"use strict";

var path = require("path"),
    fs = require("fs"),
    utils = require("../lib/utils"),
    Wind = utils.Wind,
    _ = Wind._;

var npmDir = path.join(__dirname, "../bin/npm");
var srcDir = path.join(__dirname, "../src");
var libDir = path.join(__dirname, "../lib");

if (path.existsSync(npmDir)) {
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

var descriptions = {
    "core": "The essential components for Wind.",
    "compiler": "The compiler for Wind.js, providing the monadic code transformation ability without losing traditional JavaScript programming experience."
};

var getPackageData = function (name) {
    var packageData = _.clone(packageBase);
    
    var options = name && Wind.modules[name];
    if (options === undefined) {
        packageData.name = "wind";
        packageData.version = Wind.coreVersion;
        packageData.main = "wind.js";
    } else {
        packageData.name = "wind-" + options.name;
        packageData.version = Wind.modules[options.name].version;
        packageData.main = "wind-" + options.name + ".js";
        
        if (options.autoloads) {
            packageData.dependencies = {};
            _.each(options.autoloads, function (name) {
                packageData.dependencies["wind-" + name] = options.dependencies[name];
            });
        }
    }
    
    return packageData;
}

var json2str = function (json) {
    return JSON.stringify(json, null, 4);
}

var buildOne = function (name) {
    var isCore = (name === undefined);
    
    var dir = path.join(npmDir, isCore ? "wind" : "wind-" + name);
    fs.mkdirSync(dir);

    var filename = isCore ? "wind.js" : "wind-" + name + ".js";
    utils.copySync(path.join(srcDir, filename), path.join(dir, filename));
    
    var packageData = getPackageData(name);
    var packageContent = json2str(packageData);
    fs.writeFileSync(path.join(dir, "package.json"), packageContent, "utf8");
    
    console.log((isCore ? "wind" : "wind-" + name) + " generated.");
}

var buildAot = function () {
    var dir = path.join(npmDir, "windc");
    fs.mkdirSync(dir);
    
    fs.mkdirSync(path.join(dir, "lib"));
    utils.copySync(path.join(libDir, "narcissus-parser.js"), path.join(dir, "lib/narcissus-parser.js"));
    
    fs.mkdirSync(path.join(dir, "src"));
    utils.copySync(path.join(srcDir, "windc.js"), path.join(dir, "src/windc.js"));
    
    var packageData = _.clone(packageBase);
    packageData.name = "windc";
    packageData.version = "0.2.3";
    packageData.main = "src/windc.js";
    packageData.description = "The AOT compiler for Wind";
    packageData.dependencies = {
        "wind": "~0.6.5",
        "wind-compiler": "~0.7.0",
        "optimist": "*"
    };
    
    var packageContent = json2str(packageData);
    fs.writeFileSync(path.join(dir, "package.json"), packageContent, "utf8");
    
    console.log("windc generated.");
}

buildOne(); // core

var modules = [ "compiler", "builderbase", "async", "promise" ];
_.each(modules, function (name) {
    buildOne(name);
});

buildAot();
