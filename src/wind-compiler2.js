(function () {
    "use strict";

    var Wind, _;
    
    var codeGenerator = (typeof eval("(function () {})") == "function") ?
        function (code) { return code; } :
        function (code) { return "false || " + code; };
        
    // support string type only.
    var stringify = (typeof JSON !== "undefined" && JSON.stringify) ?
        function (s) { return JSON.stringify(s); } :
        (function () {
            // Implementation comes from JSON2 (http://www.json.org/js.html)
        
            var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
            
            var meta = {    // table of character substitutions
                '\b': '\\b',
                '\t': '\\t',
                '\n': '\\n',
                '\f': '\\f',
                '\r': '\\r',
                '"' : '\\"',
                '\\': '\\\\'
            }
            
            return function (s) {
                // If the string contains no control characters, no quote characters, and no
                // backslash characters, then we can safely slap some quotes around it.
                // Otherwise we must also replace the offending characters with safe escape
                // sequences.

                escapable.lastIndex = 0;
                return escapable.test(s) ? '"' + s.replace(escapable, function (a) {
                    var c = meta[a];
                    return typeof c === 's' ? c :
                        '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                }) + '"' : '"' + s + '"';
            };
        })();
    
    function getPrecedence(ast) {
        var type = ast[0];
        switch (type) {
            case "dot": // .
            case "sub": // []
            case "call": // ()
                return 1;
            case "unary-postfix": // ++ -- - ~ ! delete new typeof void
            case "unary-prefix":
                return 2;
            case "var":
            case "binary":
                switch (ast[1]) {
                    case "*":
                    case "/":
                    case "%":
                        return 3;
                    case "+":
                    case "-":
                        return 4;
                    case "<<":
                    case ">>":
                    case ">>>":
                        return 5;
                    case "<":
                    case "<=":
                    case ">":
                    case ">=":
                    case "instanceof":
                        return 6;
                    case "==":
                    case "!=":
                    case "===":
                    case "!==":
                        return 7;
                    case "&":
                        return 8;
                    case "^":
                        return 9;
                    case "|":
                        return 10;
                    case "&&":
                        return 11;
                    case "||":
                        return 12;
                }
            case "conditional":
                return 13;
            case "assign":
                return 14;
            case "new":
                return 15;
            case "seq":
            case "stat":
            case "name":
            case "object":
            case "array":
            case "num":
            case "regexp":
            case "string":
            case "function":
            case "defun":
            case "for":
            case "for-in":
            case "block":
            case "while":
            case "do":
            case "if":
            case "break":
            case "continue":
            case "return":
            case "throw":
            case "try":
            case "switch": 
                return 0;
            default:
                return 100; // the lowest
        }
    }
    
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

    var CodeWriter = function (indent) {
        this._indent = indent || "    ";
        this._indentLevel = 0;
        
        this.lines = [];
    }
    CodeWriter.prototype = {
        write: function (str) {
            if (str === undefined) return;
            
            if (this.lines.length == 0) {
                this.lines.push("");
            }

            this.lines[this.lines.length - 1] += str;
            return this;
        },
        
        writeLine: function () {
            this.write.apply(this, arguments);
            this.lines.push("");
            return this;
        },
        
        writeIndents: function () {
            var indents = new Array(this._indentLevel);
            for (var i = 0; i < this._indentLevel; i++) {
                indents[i] = this._indent;
            }
            
            this.write(indents.join(""));
            return this;
        }, 
        
        addIndentLevel: function (diff) {
            this._indentLevel += diff;
            return this;
        }
    };
    
    var SeedProvider = function () {
        this._seeds = {};
    }
    SeedProvider.prototype.next = function (key) {
        var value = this._seeds[key];
        if (value == undefined) {
            this._seeds[key] = 0;
            return 0;
        } else {
            this._seeds[key] = ++value;
            return value;
        }
    }
    
    var WindAstGenerator = function (binder, seedProvider) {
        this._binder = binder;
        this._seedProvider = seedProvider || new SeedProvider();
        this._currentStatements = null;
    };
    WindAstGenerator.prototype = {
        generate: function (ast) {
            var rootAst = { type: "Delay", children: [] };
            var funcAst = ast.body[0].expression;

            this._generateStatements(funcAst.body.body, 0, rootAst.children);
            
            return rootAst;
        },
        
        _createBindAst: function (isReturn, argName, assignee, expression) {
            return {
                type: "Bind",
                isReturn: isReturn,
                argName: argName,
                assignee: assignee,
                expression: expression,
                following: []
            };
        },
        
        _getBindAst: function (ast) {
            // $await(xxx);
            var exprStyle = {
                type: "ExpressionStatement",
                expression: {
                    type: "CallExpression",
                    callee: { type: "Identifier", name: this._binder }
                }
            };
            
            if (isSubset(ast, exprStyle)) {
                var args = ast.expression.arguments;
                if (args.length != 1) return;
                
                return this._createBindAst(false, "", null, args[0]);
            };
            
            // var a = $await(xxx);
            var varDeclStyle = {
                type: "VariableDeclaration",
                declarations: [ {
                    type: "VariableDeclarator",
                    id: {
                        type: "Identifier",
                    },
                    init: {
                        type: "CallExpression",
                        callee: {
                            type: "Identifier",
                            name: this._binder
                        }
                    }
                } ]
            };
            
            if (isSubset(ast, varDeclStyle)) {
                var declarator = ast.declarations[0];
                var args = declarator.init.arguments;
                if (args.length != 1) return;

                return this._createBindAst(false, declarator.id.name, null, args[0]);
            };
        },
        
        _generateStatements: function (statements, index, children) {
            if (index >= statements.length) {
                return;
            }
            
            var currStmt = statements[index];
            var bindAst = this._getBindAst(currStmt);
            
            if (bindAst) {
                children.push(bindAst);
                
                if (!bindAst.isReturn) {
                    this._generateStatements(statements, index + 1, bindAst.following);
                }
                
                return;
            }
            
            switch (currStmt.type) {
                case "ReturnStatement":
                case "BreakStatement":
                case "ContinueStatement":
                case "ThrowStatement":
                    children.push({ type: "Raw", statement: currStmt });
                    return;
            }
            
            this._generateAst(currStmt, children);
            
            if (index === statements.length - 1) return;
            
            if (children[children.length - 1].type === "Raw") {
                this._generateStatements(statements, index + 1, children);
                return;
            }
            
            var combineAst = {
                type: "Combine",
                first: { type: "Delay", children: [ children.pop() /* replace the last */ ] },
                second: { type: "Delay", children: [] }
            };
            
            children.push(combineAst);
            this._generateStatements(statements, index + 1, combineAst.second.children);
        },
        
        _noBinding: function (children) {
            if (!children) return true;
            if (children.length <= 0) return true;
            
            switch (children[children.length - 1].type) {
                case "Raw": return true;
            }
            
            return false;
        },
        
        _generateBodyStatements: function (body) {
            var bodyStatements = body.type == "BlockStatement" ? body.body : [ body ];
            
            var children = [];
            this._generateStatements(bodyStatements, 0, children);
            
            return children;
        },
        
        _generateAst: function (ast, children) {
            var generator = this._astGenerators[ast.type];
            if (!generator) {
                children.push({ type: "Raw", statement: ast });
                return;
            }
            
            generator.call(this, ast, children);
        },
        
        _astGenerators: {
            "WhileStatement": function (ast, children) {
                var bodyChildren = this._generateBodyStatements(ast.body);
                if (this._noBinding(bodyChildren)) {
                    children.push({ type: "Raw", statement: ast });
                    return;
                }
                
                children.push({
                    type: "While",
                    test: ast.test,
                    body: { type: "Delay", children: bodyChildren }
                });
            },
            
            "ForStatement": function (ast, children) {
                var bodyChildren = this._generateBodyStatements(ast.body);
                if (this._noBinding(bodyChildren)) {
                    children.push({ type: "Raw", statement: ast });
                    return;
                }
                    
                if (ast.init) {
                    children.push({ type: "Raw", statement: ast.init });
                }
                
                children.push({
                    type: "For",
                    test: ast.test,
                    update: ast.update,
                    body: { type: "Delay", children: bodyChildren }
                });
            },
            
            "IfStatement": function (ast, children) {
                var consequent = this._generateBodyStatements(ast.consequent);
                var alternate = ast.alternate ? this._generateBodyStatements(ast.alternate) : null;
                
                if (this._noBinding(consequent) && this._noBinding(alternate)) {
                    children.push({ type: "Raw", statement: ast });
                    return;
                }
                
                children.push({
                    type: "If",
                    test: ast.test,
                    consequent: consequent,
                    alternate: alternate
                });
            }
        }
    };
    
    var Fn = Function, global = Fn('return this')();
    
    var compile = function (builderName, fn) {
        var esprima = (typeof require === "function") ? require("esprima") : global.esprima;
        var inputAst = esprima.parse("(" + fn.toString() + ")");
        var binder = Wind.binders[builderName];
        var windAst = (new WindAstGenerator(binder)).generate(inputAst);
        return windAst;
    };
    
    // CommonJS
    var isCommonJS = !!(typeof require === "function" && typeof module !== "undefined" && module.exports);

    var defineModule = function () {
        _ = Wind._;

        Wind.define({
            name: "compiler2",
            version: "0.7.1",
            require: isCommonJS && require,
            dependencies: { core: "~0.7.0" },
            init: function () {
                Wind.compile = compile;
            }
        });
    };
    
    if (isCommonJS) {
        try {
            Wind = require("./wind-core");
        } catch (ex) {
            Wind = require("wind-core");
        }
        
        defineModule();
    } else {
        if (!global.Wind) {
            throw new Error('Missing the root object, please load "wind" component first.');
        }
        
        Wind = global.Wind;
        defineModule();
    }
})();