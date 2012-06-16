"use strict";

var path = require("path"),
    fs = require("fs"),
    utils = require("../lib/utils"),
    Jscex = utils.Jscex,
    execAsync = Jscex.Async.Binding.fromCallback(require('child_process').exec, "_ignored_", "stdout", "stderr"),
    _ = Jscex._;

Jscex.logger.level = Jscex.Logging.Level.INFO;

var prodDir = path.join(__dirname, "../bin/prod");
var srcDir = path.join(__dirname, "../src");
var gccPath = path.join(__dirname, "../tools/compiler.jar");

if (path.existsSync(prodDir)) {
    utils.rmdirSync(prodDir);
}

fs.mkdirSync(prodDir);

var buildOne = eval(Jscex.compile("async", function (module) {
    var fullName, version;
    if (!module) {
        fullName = "jscex";
        version = Jscex.coreVersion;
    } else {
        fullName = "jscex-" + module;
        version = Jscex.modules[module];
    }
    
    var inputFile = fullName + ".js";
    var outputFile = fullName + "-" + version + ".min.js";

    var command = _.format(
        "java -jar {0} --js {1} --js_output_file {2} --compilation_level SIMPLE_OPTIMIZATIONS",
        gccPath,
        path.join(srcDir, inputFile),
        path.join(prodDir, outputFile));
    
    utils.stdout("Generating {0}...", outputFile);
    
    var r = $await(execAsync(command));
    if (r.stderr) {
        utils.stdout("failed.\n");
        utils.stderr(r.stderr + "\n");
    } else {
        utils.stdout("done.\n");
    }
}));

var buildAll = eval(Jscex.compile("async", function (modules) {
    for (var i = 0; i < modules.length; i++) {
        $await(buildOne(modules[i]));
    }
}));

buildAll(["", "builderbase", "async", "async-powerpack"]).start();