require("../lib/uglifyjs-parser.js");
require("../lib/narcissus-parser.js");
require("../src/jscex.js");
require("../src/jscex.async.js");

var fs = require("fs");

var inputFile, outputFile;
for (var i = 2; i < process.argv.length; i++) {
    var name = process.argv[i];
    if (name == "--input") {
        inputFile = process.argv[++i];
    } else if (name == "--output") {
        outputFile = process.argv[++i];
    }
}

console.log(inputFile);
console.log(outputFile);
