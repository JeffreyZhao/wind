require("../lib/uglifyjs-parser.js");
require("../lib/narcissus-parser.js");
require("../src/jscex.js");
require("../src/jscex.async.js");

var fs = require("fs");
var je = require("./JscexExtractor.js");

function generateCode(inputCode, results) {
    var codeParts = [];
    var lastIndex = 0;

    for (var i = 0; i < results.length; i++) {
        var item = results[i];
        var compiledCode = Jscex.compile(item.builderName, item.funcCode);
        codeParts.push(inputCode.substring(lastIndex, item.start));
        codeParts.push(compiledCode);
        lastIndex = item.end + 1;
    }

    if (lastIndex < inputCode.length) {
        codeParts.push(inputCode.substring(lastIndex));
    }
    
    return codeParts.join("");
}

var inputFile, outputFile;
for (var i = 2; i < process.argv.length; i++) {
    var name = process.argv[i];
    if (name == "--input") {
        inputFile = process.argv[++i];
    } else if (name == "--output") {
        outputFile = process.argv[++i];
    }
}

var code = fs.readFileSync(inputFile, "utf-8");
var codeAst = Narcissus.parser.parse(code);
var results = je.extract(codeAst);
var newCode = generateCode(codeAst.getSource(), results);

fs.writeFileSync(outputFile, newCode, "utf-8");
