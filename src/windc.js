var Wind;

try {
    Wind = require("./wind");
} catch (ex) {
    Wind = require("wind");
}

var _ = Wind._;

var esprima = require("esprima");

Wind.logger.level = Wind.Logging.Level.WARN;

var rootName;

var isSubset = function (full, partial) {
    if (full === partial) return true;
    
    if (typeof full !== typeof partial) return false
    switch (typeof full) {
        case "string":
        case "number":
        case "boolean":
        case "undefined":
            return full === partial;
    }
    
    if (full === null && partial !== null) return false;
    if (full !== null && partial === null) return false;

    if (_.isArray(full)) {
        if (!_.isArray(partial)) return false;
        if (full.length != partial.length) return false;

        for (var i = 0; i < full.length; i++) {
            if (!isSubset(full[i], partial[i])) return false;
        }

        return true;
    }
    
    if (_.isArray(partial)) return false;
    
    var result = _.each(partial, function (key, value) {
        if (!(key in full)) return false;
        if (!isSubset(full[key], value)) return false;
    });
    
    if (result === false) return false
    
    return true;
};

var extract = function (codeAst) {
    var results = [];

    var windPattern = {
        "type": "CallExpression",
        "callee": { "type": "Identifier", "name": "eval" },
        "arguments": [ {
            "type": "CallExpression",
            "callee": {
                "type": "MemberExpression",
                "computed": false,
                "object": { "type": "Identifier", "name": "Wind" },
                "property": { "type": "Identifier", "name": "compile" }
            },
            "arguments": [ { "type": "Literal" }, { "type": "FunctionExpression" } ]
        } ]
    };

    var tryExtractWindMethod = function (ast) {
        if (!isSubset(ast, windPattern)) return false;

        var builderName = ast.arguments[0].arguments[0].value;
        if (typeof builderName !== "string") return false;
            
        results.push({
            builderName: builderName,
            patternRange: ast.range,
            funcRange: ast.arguments[0].arguments[1].range
        });

        return true;
    };

    var visitAll = function (array) {
        for (var i = 0; i < array.length; i++) {
            visit(array[i]);
        }
    };
    
    var visit = function (ast) {
        switch (ast.type) {
            case "Program":
            case "BlockStatement":
                visitAll(ast.body);
                break;
            case "ExpressionStatement":
                visit(ast.expression);
                break;
            case "MemberExpression":
                visit(ast.object);
                visit(ast.property);
                break;
            case "BinaryExpression":
            case "AssignmentExpression":
            case "LogicalExpression":
                visit(ast.left);
                visit(ast.right);
                break;
            case "VariableDeclarator":
                if (ast.init) visit(ast.init);
                break;
            case "VariableDeclaration":
                visitAll(ast.declarations);
                break;
            case "ReturnStatement":
                if (ast.argument) visit(ast.argument);
                break;
            case "UnaryExpression":
            case "ThrowStatement":
                visit(ast.argument);
                break;
            case "NewExpression":
                visit(ast.callee);
                visitAll(ast.arguments);
                break;
            case "ConditionalExpression":
                visit(ast.test);
                visit(ast.consequent);
                visit(ast.alternate);
                break;
            case "IfStatement":
                visit(ast.test);
                visit(ast.consequent);
                if (ast.alternate) visit(ast.alternate);
                break;
            case "ObjectExpression":
                visitAll(ast.properties);
                break;
            case "Property":
                visit(ast.value);
                break;
            case "ArrayExpression":
                visitAll(ast.elements);
                break;
            case "ForStatement":
                if (ast.init) visit(ast.init);
                if (ast.test) visit(ast.test);
                if (ast.update) visit(ast.update);
                visit(ast.body);
                break;
            case "ForInStatement":
                visit(ast.right);
                visit(ast.body);
                break;
            case "CallExpression":
                if (!tryExtractWindMethod(ast)) {
                    visit(ast.callee);
                    visitAll(ast.arguments);
                }
                break;
            case "TryStatement":
                visit(ast.block);
                visitAll(ast.handlers);
                if (ast.finalizer) visit(ast.finalizer);
                break;
            case "CatchClause":
            case "FunctionExpression":
            case "FunctionDeclaration":
            case "LabeledStatement":
                visit(ast.body);
                break;
            case "WhileStatement":
            case "DoWhileStatement":
                visit(ast.test);
                visit(ast.body);
                break;
            case "SequenceExpression":
                visitAll(ast.expressions);
                break;
            case "SwitchStatement":
                visit(ast.discriminant);
                visitAll(ast.cases);
                break;
            case "SwitchCase":
                if (ast.test) visit(ast.test);
                visitAll(ast.consequent);
                break;
            case "WithStatement":
                visit(ast.object);
                visit(ast.body);
                break;
            case "Identifier":
            case "Literal":
            case "UpdateExpression":
            case "ThisExpression":
            case "ContinueStatement":
            case "BreakStatement":
            case "EmptyStatement":
            case "DebuggerStatement":
                break;
            default:
                console.log(ast);
                throw ast.type;
        }
    };
    
    visit(codeAst);
    
    return results;
};

function generateCode(inputCode, results) {
    var codeParts = [];
    var lastIndex = 0;

    for (var i = 0; i < results.length; i++) {
        var item = results[i],
            patternRange = item.patternRange,
            funcRange = item.funcRange;
        
        var originalCode = inputCode.substring(funcRange[0], funcRange[1] + 1);
        var compiledCode = Wind.compile(item.builderName, originalCode, { noSourceUrl: true });
        
        codeParts.push(inputCode.substring(lastIndex, patternRange[0]));
        codeParts.push(compiledCode);
        lastIndex = patternRange[1] + 1;
    }

    if (lastIndex < inputCode.length) {
        codeParts.push(inputCode.substring(lastIndex));
    }
    
    return codeParts.join("");
}

var compile = function (code, binders) {
    binders = binders || { "async": "$await", "seq": "$yield" };
    
    var oldBinders = Wind.binders;
    Wind.binders = binders;
    
    try {
        var codeAst = esprima.parse(code, { range: true });
        var results = extract(codeAst);
        return generateCode(code, results);
    } finally {
        Wind.binders = oldBinders;
    }
}

if (module.parent) { // command
    exports.compile = compile;
} else {

    var argv = require("optimist")
        .usage("Usage: $0 [options]")
        .demand("input").alias("input", "i").describe("input", "The input file")
        .demand("output").alias("output", "o").describe("output", "The output file")
        .default("root", "Wind").describe("root", "The name of root")
        .argv;

    Wind.compile.rootName = rootName = argv.root;

    var fs = require("fs");
    var code = fs.readFileSync(argv.input, "utf-8");
    var newCode = compile(code);
    fs.writeFileSync(argv.output, newCode, "utf-8");
}