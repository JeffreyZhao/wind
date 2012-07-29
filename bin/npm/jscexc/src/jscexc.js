require("../lib/narcissus-parser");

module.paths.unshift(__dirname);

var Jscex = require("jscex");
require("jscex-jit").init(Jscex);

Jscex.logger.level = Jscex.Logging.Level.WARN;

var rootName;

var extract = function (ast) {

    var results = [];
    var code = ast.getSource();

    var visitAll = function (nodes) {
        for (var i = 0; i < nodes.length; i++) {
            visit(nodes[i]);
        }
    }

    var visitCall = function (node) {
        try {
            var isEval = (node.children[0].value == "eval");
            var isJscexCompile = (node.children[1].children[0].children[0].getSource() == rootName + ".compile");

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

        visitAll(node.children);
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
            case "UNARY_MINUS":
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
            case "&&":
            case "||":
			case "|":
			case "^":
			case "&":
			case "==":
			case "!=":
			case "===":
			case "!==":
			case "<<":
			case ">>":
			case "%":
			case ">>>":
			case "~":
			case "UNARY_PLUS":
			case "delete":
			case "instanceof":
			case "typeof":
			case "void":
                visitAll(node.children);
                break;
            case "IDENTIFIER":
                visit(node.initializer);
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
				visit(node.condition);
                visit(node.thenPart);
                visit(node.elsePart);
                break;
			case "FOR_IN":
				visit(node.object);
				visit(node.iterator);
				visit(node.varDecl);
				visit(node.body);
				break;
			case "with":
				visit(node.object);
				visit(node.body);
				break;
            case "for":
                visit(node.setup);
                visit(node.condition);
                visit(node.update);
                visit(node.body);
                break;
			case "switch":
				visit(node.discriminant);
				visitAll(node.cases);
				break;
			case "case":
			case "default":
				visit(node.statements);
				break;
            case "while":
            case "do":
            case "function":
                visit(node.body);
                break;
            case "return":
                visit(node.value);
                break;
            case "throw":
                visit(node.exception);
                break;
            case "NUMBER":
            case "STRING":
			case "REGEXP":
            case "break":
			case "continue":
			case "debugger":
            case "null":
            case "true":
            case "false":
            case "this":
                break;
            default:
                throw new Error('"' + token + '" is not currently supported.');
        }
    }

    visit(ast);

    return results;
}

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

var compile = function (code, binders) {
    binders = binders || { "async": "$await", "seq": "$yield" };
    
    var oldBinders = Jscex.binders;
    Jscex.binders = binders;
    
    try {
        var codeAst = Narcissus.parser.parse(code);
        var results = extract(codeAst);
        return generateCode(codeAst.getSource(), results);
    } finally {
        Jscex.binders = oldBinders;
    }
}

if (module.parent) { // command
    exports.compile = compile;
} else {

    var argv = require("optimist")
        .usage("Usage: $0 [options]")
        .demand("input").alias("input", "i").describe("input", "The input file")
        .demand("output").alias("output", "o").describe("output", "The output file")
        .default("root-name", "Jscex").describe("root-name", "The name of root")
        .argv;

    Jscex.compile.rootName = rootName = argv["root-name"];

    var fs = require("fs");
    var code = fs.readFileSync(argv.input, "utf-8");
    var newCode = compile(code);
    fs.writeFileSync(argv.output, newCode, "utf-8");
}
