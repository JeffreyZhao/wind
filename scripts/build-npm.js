"use strict";

var path = require("path"),
    fs = require("fs"),
    utils = require("../lib/utils"),
    Jscex = utils.Jscex,
    _ = require("underscore");

var npmDir = path.join(__dirname, "../bin/npm");
var srcDir = path.join(__dirname, "../src");
var gccPath = path.join(__dirname, "../tools/compiler.jar");

if (path.existsSync(npmDir)) {
    utils.rmdirSync(npmDir);
}

fs.mkdirSync(npmDir);

var packageBase = {
    author: "Jeffrey Zhao <jeffz@live.com> (http://zhaojie.me/)",
    homepage: "https://github.com/JeffreyZhao/jscex",
    bugs: {
        "url": "https://github.com/JeffreyZhao/jscex/issues",
        "email": "jeffz@live.com"
    }
};

var descriptions = {
    "core": "The essential components for Jscex.",
    "parser": "The UglifyJS parser to generate AST from JavaScript souce code.",
    "jit": "The JIT compiler for Jscex, providing the monadic code transformation ability without losing traditional JavaScript programming experience."
};

var getPackageData = function (name) {
    var packageData = _.clone(packageBase);
    
    var options = name && Jscex.modules[name];
    if (options === undefined) {
        packageData.name = "jscex";
        packageData.version = Jscex.coreVersion;
        packageData.main = "jscex.js";
    } else {
        packageData.name = "jscex-" + options.name;
        packageData.version = Jscex.modules[options.name].version;
        packageData.main = "jscex-" + options.name + ".js";
        
        if (options.autoloads) {
            packageData.dependencies = {};
            _.each(options.autoloads, function (name) {
                packageData.dependencies["jscex-" + name] = options.dependencies[name];
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
    
    var dir = path.join(npmDir, isCore ? "jscex" : "jscex-" + name);
    fs.mkdirSync(dir);

    var filename = isCore ? "jscex.js" : "jscex-" + name + ".js";
    utils.copySync(path.join(srcDir, filename), path.join(dir, filename));
    
    var packageData = getPackageData(name);
    var packageContent = json2str(packageData);
    fs.writeFileSync(path.join(dir, "package.json"), packageContent, "utf8");
    
    console.log((isCore ? "jscex" : "jscex-" + name) + " generated.");
}

buildOne(); // core

var modules = [ "parser", "jit", "builderbase", "async", "async-powerpack" ];
_.each(modules, function (name) {
    buildOne(name);
});