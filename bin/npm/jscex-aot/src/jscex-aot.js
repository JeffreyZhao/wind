require("../lib/narcissus-parser");

var extract = function (ast) {

    var results = [];
    var code = ast.getSource();

    var visitChildren = function (node) {
        visitAll(node.children);
    }

    var visitAll = function (nodes) {
        for (var i = 0; i < nodes.length; i++) {
            visit(nodes[i]);
        }
    }

    var visitCall = function (node) {
        try {
            var isEval = (node.children[0].value == "eval");
            var isJscexCompile = (node.children[1].children[0].children[0].getSource() == "Jscex.compile");

            if (isEval && isJscexCompile) {

                /**
                 * Now "node.start" points to the first charactor of the "eval" method call,
                 * but "node.end" points to the next charactor of the function to compile
                 * rather than the end of "eval" calls, like this:
                 *
                 * var abc = eval(Jscex.compile("xyz", function (args) { ... } )  );
                 *           ^                                                ^
                 *       node.start                                       node.end
                 *
                 * That should be a bug of Narcissus, but currently we can only find out the
                 * two following right bracket after "node.end".
                 */
                var end = node.end - 1;
                while (code[++end] != ')');
                while (code[++end] != ')');

                results.push({
                    start: node.start,
                    end: end,
                    builderName: node.children[1].children[0].children[1].children[0].value,
                    funcCode: node.children[1].children[0].children[1].children[1].getSource()
                });

                return;
            }
        } catch (ex) { }

        visitChildren(node);
    }

    var getToken = function (node) {
        return Narcissus.definitions.tokens[node.type];
    }

    var visit = function (node) {
        if (!node) return;

        var token = getToken(node);
        switch (token) {
            case "CALL":
                visitCall(node);
                break;
            case "SCRIPT":
            case "LIST":
            case "var":
            case "BLOCK":
            case "INDEX":
            case "OBJECT_INIT":
            case "ARRAY_INIT":
            case "PROPERTY_INIT":
            case "NEW_WITH_ARGS":
            case ".":
            case ">":
            case "<":
            case ">=":
            case "<=":
            case "=":
            case "++":
            case "--":
            case "!":
            case "+":
            case "-":
            case "*":
            case "/":
            case "?":
                visitChildren(node);
                break;
            case "IDENTIFIER":
                visit(node.initializer);
                break;
            case "NUMBER":
            case "STRING":
            case "break":
            case "null":
            case "true":
            case "false":
            case "this":
                break;
            case ";":
                visit(node.expression);
                break;
            case "try":
                visit(node.tryBlock);
                visitAll(node.catchClauses);
                break;
            case "catch":
                visit(node.block);
                break;
            case "if":
                visit(node.thenPart);
                visit(node.elsePart);
                break;
            case "for":
                visit(node.setup);
                visit(node.condition);
                visit(node.update);
                visit(node.body);
                break;
            case "while":
            case "do":
            case "function":
                visit(node.body);
                break;
            case "return":
                visit(node.value);
                break;
            default:
                throw new Error('"' + token + '" is not currently supported.');
        }
    }

    visit(ast);

    return results;
}

var init = function (root) {
    if (!root.modules["jit"]) {
        throw new Error('Missing required components, please initialize "jit" module first.');
    };
    
    function generateCode(inputCode, results) {
        var codeParts = [];
        var lastIndex = 0;

        for (var i = 0; i < results.length; i++) {
            var item = results[i];
            var compiledCode = root.compile(item.builderName, item.funcCode);
            codeParts.push(inputCode.substring(lastIndex, item.start));
            codeParts.push(compiledCode);
            lastIndex = item.end + 1;
        }

        if (lastIndex < inputCode.length) {
            codeParts.push(inputCode.substring(lastIndex));
        }
        
        return codeParts.join("");
    }
    
    root.compileScript = function (code, binders) {
        binders = binders || { "async": "$await", "seq": "$yield" };
        
        var oldBinders = root.binders;
        root.binders = binders;
        
        try {
            var codeAst = Narcissus.parser.parse(code);
            var results = extract(codeAst);
            return generateCode(codeAst.getSource(), results);
        } finally {
            root.binders = oldBinders;
        }
    }
    
    root.modules["aot"] = true;
}

if (module.parent) { // command
    exports.init = init;
} else {
    module.paths.unshift(__dirname);
    
    var Jscex = require("jscex");
    require("jscex-jit").init(Jscex);
    init(Jscex);
    
    Jscex.logger.level = Jscex.Logging.Level.WARN;
    
    var inputFile, outputFile;
    for (var i = 2; i < process.argv.length; i++) {
        var name = process.argv[i];
        if (name == "--input") {
            inputFile = process.argv[++i];
        } else if (name == "--output") {
            outputFile = process.argv[++i];
        }
    }
    
    var fs = require("fs");
    var code = fs.readFileSync(inputFile, "utf-8");
    var newCode = Jscex.compileScript(code);
    fs.writeFileSync(outputFile, newCode, "utf-8");
}





