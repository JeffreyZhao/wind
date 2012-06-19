var fs = require("fs");
var path = require("path");
var util = require("util");
var rl = require("readline").createInterface(process.stdin, process.stdout);

var Jscex = require("../../src/jscex");
require("../../src/jscex-jit").init(Jscex);
require("../../src/jscex-async").init(Jscex);
require("../../src/jscex-async-powerpack").init(Jscex);

Jscex.logger.level = Jscex.Logging.Level.WARN;

var Async = Jscex.Async;
var Task = Async.Task;
var Binding = Async.Binding;

// path bindings
path.existsAsync = Binding.fromCallback(path.exists);

// util bindings
util.pumpAsync = Binding.fromStandard(util.pump);

// rl bindings
rl.questionAsync = Binding.fromCallback(rl.question);

// fs bindings
fs.mkdirAsync = Binding.fromStandard(fs.mkdir);
fs.readdirAsync = Binding.fromStandard(fs.readdir);
fs.statAsync = Binding.fromStandard(fs.stat);
fs.closeAsync = Binding.fromStandard(fs.close);
fs.openAsync = Binding.fromStandard(fs.open);
fs.readAsync = Binding.fromStandard(fs.read);
fs.writeAsync = Binding.fromStandard(fs.write);

var copyFileByLoopAsync = eval(Jscex.compile("async", function (srcFile, targetFile) {
    var fdIn = $await(fs.openAsync(srcFile, "r"));
    var fdOut = $await(fs.openAsync(targetFile, "w"));

    var bufferSize = 10240;
    var buffer = new Buffer(bufferSize);

    try {
        while (true) {
            var lengthRead = $await(fs.readAsync(fdIn, buffer, 0, bufferSize, null));
            if (lengthRead <= 0) break;
            $await(fs.writeAsync(fdOut, buffer, 0, lengthRead, null));
        }
    } finally {
        $await(fs.closeAsync(fdIn));
        $await(fs.closeAsync(fdOut));
    }
}));

var copyFileByPumpAsync = eval(Jscex.compile("async", function (srcFile, targetFile) {
    var streamIn = fs.createReadStream(srcFile);
    var streamOut = fs.createWriteStream(targetFile);
    $await(util.pumpAsync(streamIn, streamOut));
}));

var copyFileByPipeAsync = eval(Jscex.compile("async", function (srcFile, targetFile) {
    var streamIn = fs.createReadStream(srcFile);
    var streamOut = fs.createWriteStream(targetFile);
    streamIn.pipe(streamOut);
    
    var any = $await(Task.whenAny({
        errorIn: Async.onEvent(streamIn, "error"),
        errorOut: Async.onEvent(streamOut, "error"),
        end: Async.onEvent(streamOut, "close")
    }))

    if (any.key != "end") {
        throw any.task.result;
    }
}));

var copyFileAsync = eval(Jscex.compile("async", function (srcFile, targetFile) {

    var exists = $await(path.existsAsync(targetFile));
    if (exists) {
        var message = util.format('File "%s" exists, overwirte? (yes/no) > ', targetFile);
        while (true) {
            var answer = $await(rl.questionAsync(message));
            if (/^(?:yes|y)$/i.test(answer)) {
                break;
            } else if (/^(?:no|n)$/i.test(answer)) {
                return;
            }
        }
    }

    util.print(util.format('Copying "%s" to "%s" ... ', srcFile, targetFile));
    
    try {
        $await(copyFileByLoopAsync(srcFile, targetFile))
        // $await(copyFileByPumpAsync(srcFile, targetFile));
        // $await(copyFileByPipeAsync(srcFile, targetFile));
        util.print("done\n");
    } catch (ex) {
        util.print("ERROR!!!\n");
    }

}));

var copyDirAsync = eval(Jscex.compile("async", function (srcDir, targetDir) {

    var exists = $await(path.existsAsync(targetDir));
    if (!exists) {
        $await(fs.mkdirAsync(targetDir));
    }

    var files = $await(fs.readdirAsync(srcDir));
    for (var i = 0; i < files.length; i++) {
        var srcPath = path.join(srcDir, files[i]);
        var targetPath = path.join(targetDir, files[i]);
        
        var stat = $await(fs.statAsync(srcPath));
        if (stat.isFile()) {
            $await(copyFileAsync(srcPath, targetPath));
        } else {
            $await(copyDirAsync(srcPath, targetPath));
        }
    }
}));

var task = copyDirAsync(process.argv[2], process.argv[3]);
task.addEventListener("complete", function (t) {
    if (t.error) {
        console.log(t.error);
        process.exit(1);
    } else {
        process.exit();
    }
});

task.start();
