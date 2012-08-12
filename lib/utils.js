"use strict";

var fs = require("fs"),
    path = require("path"),
    Wind = require("../src/wind"),
    _ = Wind._;

var copySync = function (src, dest) {
    var content = fs.readFileSync(src, "utf8");
    fs.writeFileSync(dest, content, "utf8");
}

var rmdirSync = function (dir) {
    var files = fs.readdirSync(dir);
    for (var i = 0; i < files.length; i++) {
        var filepath = path.join(dir, files[i]);
        var stat = fs.statSync(filepath);
        if (stat.isFile()) {
            fs.unlinkSync(filepath);
        } else {
            rmdirSync(filepath);
        }
    }
    
    fs.rmdirSync(dir);
}

var stdout = function () {
    process.stdout.write(_.format.apply(this, arguments));
}

var stderr = function () {
    process.stderr.write(_.format.apply(this, arguments));
}

exports.copySync = copySync;
exports.rmdirSync = rmdirSync;
exports.stdout = stdout;
exports.stderr = stderr;
exports.Wind = Wind;