(function () {
    "use strict";
    
    var Wind;
    
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
    
    function sprintf(format) {
        var args = arguments;
        return format.toString().replace(new RegExp("{\\d+}", "g"), function (p) {
            var n = parseInt(p.substring(1, p.length - 1), 10);
            return args[n + 1];
        });
    }
    
    function trim(s) {
        return s.replace(/ +/g, "");
    }

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
    
    function isWindPattern(ast) {
        if (ast[0] != "call") return false;
        
        var evalName = ast[1];
        if (evalName[0] != "name" || evalName[1] != "eval") return false;

        var compileCall = ast[2][0];
        if (!compileCall || compileCall[0] != "call") return false;

        var compileMethod = compileCall[1];
        if (!compileMethod || compileMethod[0] != "dot" || compileMethod[2] != "compile") return false;

        var windName = compileMethod[1];
        if (!windName || windName[0] != "name" || windName[1] != compile.rootName) return false;

        var builder = compileCall[2][0];
        if (!builder || builder[0] != "string") return false;

        var func = compileCall[2][1];
        if (!func || func[0] != "function") return false;

        return true;
    }
    
    function compileWindPattern(ast, seedProvider, codeWriter, commentWriter) {

        var builderName = ast[2][0][2][0][1];
        var funcAst = ast[2][0][2][1];

        var windTreeGenerator = new WindTreeGenerator(builderName, seedProvider);
        var windAst = windTreeGenerator.generate(funcAst);

        commentWriter.write(builderName + " << ");
        var codeGenerator = new CodeGenerator(builderName, seedProvider, codeWriter, commentWriter);
        codeGenerator.generate(funcAst[2], windAst);
    }
        
    var WindTreeGenerator = function (builderName, seedProvider) {
        this._binder = Wind.binders[builderName];
        this._seedProvider = seedProvider;
    }
    WindTreeGenerator.prototype = {

        generate: function (ast) {

            var params = ast[2], statements = ast[3];

            var rootAst = { type: "delay", stmts: [] };

            this._visitStatements(statements, rootAst.stmts);

            return rootAst;
        },

        _getBindInfo: function (stmt) {

            var type = stmt[0];
            if (type == "stat") {
                var expr = stmt[1];
                if (expr[0] == "call") {
                    var callee = expr[1];
                    if (callee[0] == "name" && callee[1] == this._binder && expr[2].length == 1) {
                        return {
                            expression: expr[2][0],
                            argName: "",
                            assignee: null
                        };
                    }
                } else if (expr[0] == "assign") {
                    var assignee = expr[2];
                    expr = expr[3];
                    if (expr[0] == "call") {
                        var callee = expr[1];
                        if (callee[0] == "name" && callee[1] == this._binder && expr[2].length == 1) {
                            return {
                                expression: expr[2][0],
                                argName: "_result_$",
                                assignee: assignee
                            };
                        }
                    }
                }
            } else if (type == "var") {
                var defs = stmt[1];
                if (defs.length == 1) {
                    var item = defs[0];
                    var name = item[0];
                    var expr = item[1];
                    if (expr && expr[0] == "call") {
                        var callee = expr[1];
                        if (callee[0] == "name" && callee[1] == this._binder && expr[2].length == 1) {
                            return {
                                expression: expr[2][0],
                                argName: name,
                                assignee: null
                            };                            
                        }
                    }
                }
            } else if (type == "return") {
                var expr = stmt[1];
                if (expr && expr[0] == "call") {
                    var callee = expr[1];
                    if (callee[0] == "name" && callee[1] == this._binder && expr[2].length == 1) {
                        return {
                            expression: expr[2][0],
                            argName: "_result_$",
                            assignee: "return"
                        };
                    }
                }
            }

            return null;
        },

        _visitStatements: function (statements, stmts, index) {
            if (arguments.length <= 2) index = 0;

            if (index >= statements.length) {
                stmts.push({ type: "normal" });
                return this;
            }

            var currStmt = statements[index];
            var bindInfo = this._getBindInfo(currStmt);

            if (bindInfo) {
                var bindStmt = { type: "bind", info: bindInfo };
                stmts.push(bindStmt);

                if (bindInfo.assignee != "return") {
                    bindStmt.stmts = [];
                    this._visitStatements(statements, bindStmt.stmts, index + 1);
                }

            } else {
                var type = currStmt[0];
                if (type == "return" || type == "break" || type == "continue" || type == "throw") {

                    stmts.push({ type: type, stmt: currStmt });

                } else if (type == "if" || type == "try" || type == "for" || type == "do"
                           || type == "while" || type == "switch" || type == "for-in") {

                    var newStmt = this._visit(currStmt);

                    if (newStmt.type == "raw") {
                        stmts.push(newStmt);
                        this._visitStatements(statements, stmts, index + 1);
                    } else {
                        var isLast = (index == statements.length - 1);
                        if (isLast) {
                            stmts.push(newStmt);
                        } else {

                            var combineStmt = {
                                type: "combine",
                                first: { type: "delay", stmts: [newStmt] },
                                second: { type: "delay", stmts: [] }
                            };
                            stmts.push(combineStmt);

                            this._visitStatements(statements, combineStmt.second.stmts, index + 1);
                        }
                    }

                } else {

                    stmts.push({ type: "raw", stmt: currStmt });

                    this._visitStatements(statements, stmts, index + 1);
                }
            }

            return this;
        },

        _visit: function (ast) {

            var type = ast[0];

            function throwUnsupportedError() {
                throw new Error('"' + type + '" is not currently supported.');
            }

            var visitor = this._visitors[type];

            if (visitor) {
                return visitor.call(this, ast);
            } else {
                throwUnsupportedError();
            }
        },

        _visitBody: function (ast, stmts) {
            if (ast[0] == "block") {
                this._visitStatements(ast[1], stmts);
            } else {
                this._visitStatements([ast], stmts);
            }
        },

        _noBinding: function (stmts) {
            switch (stmts[stmts.length - 1].type) {
                case "normal":
                case "return":
                case "break":
                case "throw":
                case "continue":
                    return true;
            }

            return false;
        },

        _collectCaseStatements: function (cases, index) {
            var res = [];

            for (var i = index; i < cases.length; i++) {
                var rawStmts = cases[i][1];
                for (var j = 0; j < rawStmts.length; j++) {
                    if (rawStmts[j][0] == "break") {
                        return res
                    }

                    res.push(rawStmts[j]);
                }
            }

            return res;
        },

        _visitors: {

            "for": function (ast) {
                var bodyStmts = [];
                var body = ast[4];
                this._visitBody(body, bodyStmts);

                if (this._noBinding(bodyStmts)) {
                    return { type: "raw", stmt: ast };
                }
                
                var delayStmt = { type: "delay", stmts: [] };
                
                var setup = ast[1];
                if (setup) {
                    delayStmt.stmts.push({ type: "raw", stmt: setup });
                }
                
                var forStmt = { type: "for", bodyStmt: { type: "delay", stmts: bodyStmts } };
                delayStmt.stmts.push(forStmt);
                
                var condition = ast[2];
                if (condition) {
                    forStmt.condition = condition;
                }
                
                var update = ast[3];
                if (update) {
                    forStmt.update = update;
                }

                return delayStmt;
            },
            
            "for-in": function (ast) {

                var body = ast[4];
                
                var bodyStmts = [];
                this._visitBody(body, bodyStmts);

                if (this._noBinding(bodyStmts)) {
                    return { type: "raw", stmt: ast };
                }
                
                var forInStmt = { type: "for-in", bodyStmts: bodyStmts, obj: ast[3] };
            
                var argName = ast[2][1]; // ast[2] == ["name", m]
                if (ast[1][0] == "var") {
                    forInStmt.argName = argName;
                } else {
                    var keyVar = "_forInKey_$" + this._seedProvider.next("forInKey");
                    forInStmt.argName = keyVar;
                    forInStmt.bodyStmts.unshift({
                        type: "raw",
                        stmt: Wind.parse(argName + " = " + keyVar + ";")[1][0]
                    });
                }
            
                return forInStmt;
            },
        
            "while": function (ast) {

                var bodyStmts = [];
                var body = ast[2];
                this._visitBody(body, bodyStmts);

                if (this._noBinding(bodyStmts)) {
                    return { type: "raw", stmt: ast }
                }

                var loopStmt = { type: "while", bodyStmt: { type: "delay", stmts: bodyStmts } };

                var condition = ast[1];
                loopStmt.condition = condition;

                return loopStmt;
            },
            
            "do": function (ast) {

                var bodyStmts = [];
                var body = ast[2];
                this._visitBody(body, bodyStmts);

                if (this._noBinding(bodyStmts)) {
                    return { type: "raw", stmt: ast };
                }

                var doStmt = {
                    type: "do",
                    bodyStmt: { type: "delay", stmts: bodyStmts },
                    condition: ast[1]
                };

                return doStmt;
            },

            "switch": function (ast) {
                var noBinding = true;

                var switchStmt = { type: "switch", item: ast[1], caseStmts: [] };

                var cases = ast[2];
                for (var i = 0; i < cases.length; i++) {                    
                    var caseStmt = { item: cases[i][0], stmts: [] };
                    switchStmt.caseStmts.push(caseStmt);

                    var statements = this._collectCaseStatements(cases, i);
                    this._visitStatements(statements, caseStmt.stmts);
                    noBinding = noBinding && this._noBinding(caseStmt.stmts);
                }

                if (noBinding) {
                    return { type: "raw", stmt: ast };
                } else {
                    return switchStmt;
                }
            },

            "if": function (ast) {

                var noBinding = true;

                var ifStmt = { type: "if", conditionStmts: [] };

                var currAst = ast;
                while (true) {
                    var condition = currAst[1];
                    var condStmt = { cond: condition, stmts: [] };
                    ifStmt.conditionStmts.push(condStmt);

                    var thenPart = currAst[2];
                    this._visitBody(thenPart, condStmt.stmts);

                    noBinding = noBinding && this._noBinding(condStmt.stmts);

                    var elsePart = currAst[3];
                    if (elsePart && elsePart[0] == "if") {
                        currAst = elsePart;
                    } else {
                        break;
                    }
                }
    
                var elsePart = currAst[3];
                if (elsePart) {
                    ifStmt.elseStmts = [];

                    this._visitBody(elsePart, ifStmt.elseStmts);
                    
                    noBinding = noBinding && this._noBinding(ifStmt.elseStmts);
                }

                if (noBinding) {
                    return { type: "raw", stmt: ast };
                } else {
                    return ifStmt;
                }
            },

            "try": function (ast, stmts) {

                var bodyStmts = [];
                var bodyStatements = ast[1];
                this._visitStatements(bodyStatements, bodyStmts);

                var noBinding = this._noBinding(bodyStmts)

                var tryStmt = { type: "try", bodyStmt: { type: "delay", stmts: bodyStmts } };
                
                var catchClause = ast[2];
                if (catchClause) {
                    var exVar = catchClause[0];
                    tryStmt.exVar = exVar;
                    tryStmt.catchStmts = [];

                    this._visitStatements(catchClause[1], tryStmt.catchStmts);

                    noBinding = noBinding && this._noBinding(tryStmt.catchStmts);
                }

                var finallyStatements = ast[3];
                if (finallyStatements) {
                    tryStmt.finallyStmt = { type: "delay", stmts: [] };

                    this._visitStatements(finallyStatements, tryStmt.finallyStmt.stmts);

                    noBinding = noBinding && this._noBinding(tryStmt.finallyStmt.stmts);
                }

                if (noBinding) {
                    return { type: "raw", stmt: ast };
                } else {
                    return tryStmt;
                }
            }
        }
    }
    
    var CodeGenerator = function (builderName, seedProvider, codeWriter, commentWriter) {
        this._builderName = builderName;
        this._binder = Wind.binders[builderName];
        this._seedProvider = seedProvider;
        
        this._codeWriter = codeWriter;
        this._commentWriter = commentWriter;
    }
    CodeGenerator.prototype = {
    
        _code: function () {
            this._codeWriter.write.apply(this._codeWriter, arguments);
            return this;
        },
        
        _codeLine: function () {
            this._codeWriter.writeLine.apply(this._codeWriter, arguments);
            return this;
        },
        
        _codeIndents: function () {
            this._codeWriter.writeIndents();
            return this;
        },
        
        _codeIndentLevel: function (diff) {
            this._codeWriter.addIndentLevel(diff);
            return this;
        },
        
        _comment: function () {
            this._commentWriter.write.apply(this._commentWriter, arguments);
            return this;
        },
        
        _commentLine: function () {
            this._commentWriter.writeLine.apply(this._commentWriter, arguments);
            return this;
        },
        
        _commentIndents: function () {
            this._commentWriter.writeIndents();
            return this;
        },
        
        _commentIndentLevel: function (diff) {
            this._commentWriter.addIndentLevel(diff);
            return this;
        },
        
        _both: function () {
            this._codeWriter.write.apply(this._codeWriter, arguments);
            this._commentWriter.write.apply(this._commentWriter, arguments);

            return this;
        },
        
        _bothLine: function () {
            this._codeWriter.writeLine.apply(this._codeWriter, arguments);
            this._commentWriter.writeLine.apply(this._commentWriter, arguments);
            
            return this;
        },
        
        _bothIndents: function () {
            this._codeWriter.writeIndents();
            this._commentWriter.writeIndents();
            
            return this;
        },
        
        _bothIndentLevel: function (diff) {
            this._codeWriter.addIndentLevel(diff);
            this._commentWriter.addIndentLevel(diff);
            
            return this;
        },
        
        _newLine: function () {
            this._codeWriter.writeLine.apply(this._codeWriter, arguments);
            this._commentWriter.writeLine(); // To Remove
            return this;
        },
    
        generate: function (params, windAst) {
            this._normalMode = false;
            this._builderVar = "_builder_$" + this._seedProvider.next("builderId");
            
            this._codeLine("(function (" + params.join(", ") + ") {")._commentLine("function (" + params.join(", ") + ") {");
            this._bothIndentLevel(1);

            this._codeIndents()._newLine("var " + this._builderVar + " = " + compile.rootName + ".builders[" + stringify(this._builderName) + "];");

            this._codeIndents()._newLine("return " + this._builderVar + ".Start(this,");
            this._codeIndentLevel(1);

            this._pos = { };

            this._bothIndents()._visitWind(windAst)._newLine();
            this._codeIndentLevel(-1);

            this._codeIndents()._newLine(");");
            this._bothIndentLevel(-1);

            this._bothIndents()._code("})")._comment("}");
        },

        _visitWind: function (ast) {
            this._windVisitors[ast.type].call(this, ast);
            return this;
        },

        _visitRaw: function (ast) {
            var type = ast[0];

            var visitor = this._rawVisitors[type];
            if (visitor) {
                visitor.call(this, ast);
            } else {
                throw new Error('"' + type + '" is not currently supported.');
            }

            return this;
        },

        _visitWindStatements: function (statements) {
            for (var i = 0; i < statements.length; i++) {
                var stmt = statements[i];

                if (stmt.type == "raw" || stmt.type == "if" || stmt.type == "switch") {
                    this._bothIndents()._visitWind(stmt)._newLine();
                } else if (stmt.type == "delay") {
                    this._visitWindStatements(stmt.stmts);
                } else {
                    this._bothIndents()._code("return ")._visitWind(stmt)._newLine(";");
                }
            }
        },

        _visitRawStatements: function (statements) {
            for (var i = 0; i < statements.length; i++) {
                var s = statements[i];

                this._bothIndents()._visitRaw(s)._bothLine();

                switch (s[0]) {
                    case "break":
                    case "return":
                    case "continue":
                    case "throw":
                        return;
                }
            }
        },

        _visitRawBody: function (body) {
            if (body[0] == "block") {
                this._visitRaw(body);
            } else {
                this._bothLine();
                this._bothIndentLevel(1);

                this._bothIndents()._visitRaw(body);
                this._bothIndentLevel(-1);
            }

            return this;
        },

        _visitRawFunction: function (ast) {
            var funcName = ast[1] || "";
            var args = ast[2];
            var statements = ast[3];
            
            this._bothLine("function " + funcName + "(" + args.join(", ") + ") {")
            this._bothIndentLevel(1);

            var currInFunction = this._pos.inFunction;
            this._pos.inFunction = true;

            this._visitRawStatements(statements);
            this._bothIndentLevel(-1);

            this._pos.inFunction = currInFunction;

            this._bothIndents()._both("}");
        },
        
        _windVisitors: {
            "delay": function (ast) {
                if (ast.stmts.length == 1) {
                    var subStmt = ast.stmts[0];
                    switch (subStmt.type) {
                        case "delay":
                        case "combine":
                        case "normal":
                        case "break":
                        case "continue":
                        case "for":
                        case "for-in":
                        case "while":
                        case "do":
                        case "try":
                            this._visitWind(subStmt);
                            return;
                        case "return":
                            if (!subStmt.stmt[1]) {
                                this._visitWind(subStmt);
                                return;
                            }
                    }
                }

                this._newLine(this._builderVar + ".Delay(function () {");
                this._codeIndentLevel(1);

                this._visitWindStatements(ast.stmts);
                this._codeIndentLevel(-1);

                this._codeIndents()._code("})");
            },

            "combine": function (ast) {
                this._newLine(this._builderVar + ".Combine(");
                this._codeIndentLevel(1);

                this._bothIndents()._visitWind(ast.first)._newLine(",");
                this._bothIndents()._visitWind(ast.second)._newLine();
                this._codeIndentLevel(-1);

                this._codeIndents()._code(")");
            },
            
            "for": function (ast) {                
                if (ast.condition) {
                    this._codeLine(this._builderVar + ".For(function () {")
                        ._commentLine("for (");
                    this._codeIndentLevel(1);
                    
                    this._bothIndents()
                        ._code("return ")
                        ._comment("; ")
                            ._visitRaw(ast.condition)
                                ._newLine(";");
                    this._codeIndentLevel(-1);
                    
                    this._bothIndents()._code("}, ");
                } else {
                    this._code(this._builderVar + ".For(null, ")
                        ._comment("for (; ");
                }
                
                if (ast.update) {
                    this._newLine("function () {");
                    this._codeIndentLevel(1);
                    
                    this._bothIndents()
                        ._comment("; ")
                            ._visitRaw(ast.update)
                                ._codeLine(";")
                                ._commentLine(") {");
                    this._codeIndentLevel(-1);
                    
                    this._codeIndents()._newLine("},");
                } else {
                    this._codeLine("null,")._commentLine("; ) {");
                }
                this._bothIndentLevel(1);
                
                this._bothIndents()._visitWind(ast.bodyStmt)._newLine();
                this._bothIndentLevel(-1);
                
                this._bothIndents()._code(")")._comment("}");
            },
            
            "for-in": function (ast) {
                this._code(this._builderVar + ".ForIn(")
                    ._comment("for (var " + ast.argName + " in ")
                        ._visitRaw(ast.obj)
                            ._codeLine(", function (" + ast.argName + ") {")
                            ._commentLine(") {");
                this._bothIndentLevel(1);
                
                this._visitWindStatements(ast.bodyStmts);
                this._bothIndentLevel(-1);
                
                this._bothIndents()._code("})")._comment("}");
            },
            
            "while": function (ast) {
                this._newLine(this._builderVar + ".While(function () {");
                this._codeIndentLevel(1);
                
                this._bothIndents()
                    ._code("return ")
                    ._comment("while (")
                        ._visitRaw(ast.condition)
                            ._codeLine(";")
                            ._commentLine(") {");
                this._codeIndentLevel(-1);
                
                this._codeIndents()._newLine("},");
                this._bothIndentLevel(1);
                
                this._bothIndents()._visitWind(ast.bodyStmt)._newLine();
                this._bothIndentLevel(-1);
                
                this._bothIndents()._code(")")._comment("}");
            },
            
            "do": function (ast) {
                this._codeLine(this._builderVar + ".Do(")._commentLine("do {");
                this._bothIndentLevel(1);
                
                this._bothIndents()._visitWind(ast.bodyStmt)._newLine(",");
                this._commentIndentLevel(-1);
                
                this._codeIndents()._newLine("function () {");
                this._codeIndentLevel(1);
                
                this._bothIndents()
                    ._code("return ")
                    ._comment("} while (")
                        ._visitRaw(ast.condition)
                            ._codeLine(";")
                            ._commentLine(");");
                this._codeIndentLevel(-1);
                
                this._codeIndents()._newLine("}");
                this._codeIndentLevel(-1);
                
                this._codeIndents()._code(")");
            },

            "raw": function (ast) {
                this._visitRaw(ast.stmt, true);
            },

            "bind": function (ast) {
                var info = ast.info;
                
                var commentPrefix = "";
                if (info.assignee == "return") {
                    commentPrefix = "return ";
                } else if (info.argName != "") {
                    commentPrefix = "var " + info.argName + " = ";
                }
                
                this._code(this._builderVar + ".Bind(")._comment(commentPrefix + this._binder + "(")._visitRaw(info.expression)._comment(");")._newLine(", function (" + info.argName + ") {");
                this._codeIndentLevel(1);

                if (info.assignee == "return") {
                    this._codeIndents()
                        ._newLine("return " + this._builderVar + ".Return(" + info.argName + ");");
                } else {
                    if (info.assignee) {
                        this._bothIndents()
                            ._visitRaw(info.assignee)._bothLine(" = " + info.argName + ";");
                    }

                    this._visitWindStatements(ast.stmts);
                }
                this._codeIndentLevel(-1);

                this._codeIndents()
                    ._code("})");
            },

            "if": function (ast) {

                for (var i = 0; i < ast.conditionStmts.length; i++) {
                    var stmt = ast.conditionStmts[i];
                    
                    this._both("if (")._visitRaw(stmt.cond)._bothLine(") {");
                    this._bothIndentLevel(1);

                    this._visitWindStatements(stmt.stmts);
                    this._bothIndentLevel(-1);

                    if (i < ast.conditionStmts.length - 1 || ast.elseStmts) {
                        this._bothIndents()._both("} else ");
                    } else {
                        this._bothIndents()._code("} else ")._comment("}");
                    }
                }

                if (ast.elseStmts) {
                    this._bothLine("{");
                    this._bothIndentLevel(1);
                } else {
                    this._newLine("{");
                    this._codeIndentLevel(1);
                }

                if (ast.elseStmts) {
                    this._visitWindStatements(ast.elseStmts);
                } else {
                    this._codeIndents()
                        ._newLine("return " + this._builderVar + ".Normal();");
                }

                if (ast.elseStmts) {
                    this._bothIndentLevel(-1);
                } else {
                    this._codeIndentLevel(-1);
                }

                if (ast.elseStmts) {
                    this._bothIndents()
                        ._both("}");
                } else {
                    this._codeIndents()
                        ._code("}");
                }
            },

            "switch": function (ast) {
                this._both("switch (")._visitRaw(ast.item)._bothLine(") {");
                this._bothIndentLevel(1);

                for (var i = 0; i < ast.caseStmts.length; i++) {
                    var caseStmt = ast.caseStmts[i];
                    
                    if (caseStmt.item) {
                        this._bothIndents()
                            ._both("case ")._visitRaw(caseStmt.item)._bothLine(":");
                    } else {
                        this._bothIndents()._bothLine("default:");
                    }
                    this._bothIndentLevel(1);

                    this._visitWindStatements(caseStmt.stmts);                    
                    this._bothIndentLevel(-1);
                }

                this._bothIndents()._code("}");
            },

            "try": function (ast) {
                this._codeLine(this._builderVar + ".Try(")._commentLine("try {");
                this._bothIndentLevel(1);

                this._bothIndents()._visitWind(ast.bodyStmt)._newLine(",");
                this._commentIndentLevel(-1);
                
                if (ast.catchStmts) {
                    this._bothIndents()
                        ._codeLine("function (" + ast.exVar + ") {")
                        ._commentLine("} catch (" + ast.exVar + ") {");
                    this._bothIndentLevel(1);

                    this._visitWindStatements(ast.catchStmts);
                    this._bothIndentLevel(-1);

                    this._bothIndents()._codeLine("},");
                    if (ast.finallyStmt) {
                        this._commentLine("} finally {");
                    } else {
                        this._commentLine("}");
                    }
                } else {
                    this._bothIndents()._codeLine("null,")._commentLine("} finally {");
                }
                
                if (ast.finallyStmt) {
                    this._commentIndentLevel(1);
                    this._bothIndents()._visitWind(ast.finallyStmt)._newLine();
                    this._commentIndentLevel(-1);
                } else {
                    this._codeIndents()._newLine("null");
                }
                this._codeIndentLevel(-1);
                
                this._codeIndents()._code(")");
                if (ast.finallyStmt) {
                    this._commentIndents()._comment("}");
                }
            },

            "normal": function (ast) {
                this._code(this._builderVar + ".Normal()");
            },

            "throw": function (ast) {
                this
                    ._code(this._builderVar + ".Throw(")
                    ._comment("throw ")
                        ._visitRaw(ast.stmt[1])
                            ._code(")")._comment(";");
            },

            "break": function (ast) {
                this._code(this._builderVar + ".Break()")._comment("break;");
            },

            "continue": function (ast) {
                this._code(this._builderVar + ".Continue()")._comment("continue;");
            },

            "return": function (ast) {
                this._code(this._builderVar + ".Return(")._comment("return");
                if (ast.stmt[1]) {
                    this._comment(" ")._visitRaw(ast.stmt[1]);
                }
                
                this._code(")")._comment(";");
            }
        },

        _rawVisitors: {
            "var": function (ast) {
                this._both("var ");

                var items = ast[1];
                for (var i = 0; i < items.length; i++) {
                    this._both(items[i][0]);
                    if (items[i].length > 1) {
                        this._both(" = ")._visitRaw(items[i][1]);
                    }
                    if (i < items.length - 1) this._both(", ");
                }

                this._both(";");
            },

            "seq": function (ast, noBracket) {
                var left = ast[1];
                var right = ast[2];
                
                if (!noBracket) this._both("(");
                
                this._visitRaw(left);
                this._both(", ");
                
                if (right[0] == "seq") {
                    arguments.callee.call(this, right, true);
                } else {
                    this._visitRaw(right);
                }
                
                if (!noBracket) this._both(")");
            },

            "binary": function (ast) {
                var op = ast[1], left = ast[2], right = ast[3];

                if (getPrecedence(ast) < getPrecedence(left)) {
                    this._both("(")._visitRaw(left)._both(") ");
                } else {
                    this._visitRaw(left)._both(" ");
                }

                this._both(op);

                if (getPrecedence(ast) <= getPrecedence(right)) {
                    this._both(" (")._visitRaw(right)._both(")");
                } else {
                    this._both(" ")._visitRaw(right);
                }
            },

            "sub": function (ast) {
                var prop = ast[1], index = ast[2];

                if (getPrecedence(ast) < getPrecedence(prop)) {
                    this._both("(")._visitRaw(prop)._both(")[")._visitRaw(index)._both("]");
                } else {
                    this._visitRaw(prop)._both("[")._visitRaw(index)._both("]");
                }
            },

            "unary-postfix": function (ast) {
                var op = ast[1];
                var item = ast[2];
                
                if (getPrecedence(ast) <= getPrecedence(item)) {
                    this._both("(")._visitRaw(item)._both(")");
                } else {
                    this._visitRaw(item);
                }
                
                this._both(" " + op);
            },

            "unary-prefix": function (ast) {
                var op = ast[1];
                var item = ast[2];
                
                this._both(op + " ");
                
                if (getPrecedence(ast) < getPrecedence(item)) {
                    this._both("(")._visitRaw(item)._both(")");
                } else {
                    this._visitRaw(item);
                }
            },

            "assign": function (ast) {
                var op = ast[1];
                var name = ast[2];
                var value = ast[3];
                
                if (name[0] == "assign") {
                    this._both("(")._visitRaw(name)._both(")");
                } else {
                    this._visitRaw(name);
                }
                
                if ((typeof op) == "string") {
                    this._both(" " + op + "= ");
                } else {
                    this._both(" = ");
                }
                
                this._visitRaw(value);
            },

            "stat": function (ast) {
                this._visitRaw(ast[1])._both(";");
            },

            "dot": function (ast) {
                var left = ast[1];
                var right = ast[2];
                
                if (getPrecedence(ast) < getPrecedence(left)) {
                    this._both("(")._visitRaw(left)._both(").")._both(right);
                } else {
                    this._visitRaw(left)._both(".")._both(right);
                }
            },

            "new": function (ast) {
                var ctor = ast[1];

                this._both("new ")._visitRaw(ctor)._both("(");

                var args = ast[2];
                for (var i = 0, len = args.length; i < len; i++) {
                    this._visitRaw(args[i]);
                    if (i < len - 1) this._both(", ");
                }

                this._both(")");
            },

            "call": function (ast) {
            
                if (isWindPattern(ast)) {
                    compileWindPattern(ast, this._seedProvider, this._codeWriter, this._commentWriter);
                } else {
                    var caller = ast[1];
                
                    var invalidBind = (caller[0] == "name") && (caller[1] == this._binder);
                    // throw?

                    if (getPrecedence(ast) < getPrecedence(caller)) {
                        this._both("(")._visitRaw(caller)._both(")");
                    } else {
                        this._visitRaw(caller);
                    }
                    
                    this._both("(");

                    var args = ast[2];
                    for (var i = 0; i < args.length; i++) {
                        this._visitRaw(args[i]);
                        if (i < args.length - 1) this._both(", ");
                    }

                    this._both(")");
                }
            },

            "name": function (ast) {
                this._both(ast[1]);
            },

            "object": function (ast) {
                var items = ast[1];
                if (items.length <= 0) {
                    this._both("{ }");
                } else {
                    this._bothLine("{");
                    this._bothIndentLevel(1);
                    
                    for (var i = 0; i < items.length; i++) {
                        this._bothIndents()
                            ._both(stringify(items[i][0]) + ": ")
                            ._visitRaw(items[i][1]);
                        
                        if (i < items.length - 1) {
                            this._bothLine(",");
                        } else {
                            this._bothLine("");
                        }
                    }
                    
                    this._bothIndentLevel(-1);
                    this._bothIndents()._both("}");
                }
            },

            "array": function (ast) {
                this._both("[");

                var items = ast[1];
                for (var i = 0; i < items.length; i++) {
                    this._visitRaw(items[i]);
                    if (i < items.length - 1) this._both(", ");
                }

                this._both("]");
            },

            "num": function (ast) {
                this._both(ast[1]);
            },

            "regexp": function (ast) {
                this._both("/" + ast[1] + "/" + ast[2]);
            },

            "string": function (ast) {
                this._both(stringify(ast[1]));
            },

            "function": function (ast) {
                this._visitRawFunction(ast);
            },

            "defun": function (ast) {
                this._visitRawFunction(ast);
            },
            
            "for": function (ast) {
                this._both("for (");

                var setup = ast[1];
                if (setup) {
                    this._visitRaw(setup);
                    if (setup[0] != "var") {
                        this._both("; ");
                    } else {
                        this._both(" ");
                    }
                } else {
                    this._both("; ");
                }

                var condition = ast[2];
                if (condition) this._visitRaw(condition);
                this._both("; ");

                var update = ast[3];
                if (update) this._visitRaw(update);
                this._both(") ");

                var currInLoop = this._pos.inLoop;
                this._pos.inLoop = true;

                var body = ast[4];
                this._visitRawBody(body);

                this._pos.inLoop = currInLoop;
            },

            "for-in": function (ast) {
                this._both("for (");

                var declare = ast[1];
                if (declare[0] == "var") { // declare == ["var", [["m"]]]
                    this._both("var " + declare[1][0][0]);
                } else {
                    this._visitRaw(declare);
                }
                
                this._both(" in ")._visitRaw(ast[3])._both(") ");

                var body = ast[4];
                this._visitRawBody(body);
            },

            "block": function (ast) {
                this._bothLine("{")
                this._bothIndentLevel(1);

                this._visitRawStatements(ast[1]);
                this._bothIndentLevel(-1);

                this._bothIndents()
                    ._both("}");
            },

            "while": function (ast) {
                var condition = ast[1];
                var body = ast[2];

                var currInLoop = this._pos.inLoop;
                this._pos.inLoop = true;

                this._both("while (")._visitRaw(condition)._both(") ")._visitRawBody(body);

                this._pos.inLoop = currInLoop;
            },

            "do": function (ast) {
                var condition = ast[1];
                var body = ast[2];

                var currInLoop = this._pos.inLoop;
                this._pos.inLoop = true;

                this._both("do ")._visitRawBody(body);

                this._pos.inLoop = currInLoop;

                if (body[0] == "block") {
                    this._both(" ");
                } else {
                    this._bothLine()
                        ._bothIndents();
                }

                this._both("while (")._visitRaw(condition)._both(");");
            },

            "if": function (ast) {
                var condition = ast[1];
                var thenPart = ast[2];

                this._both("if (")._visitRaw(condition)._both(") ")._visitRawBody(thenPart);

                var elsePart = ast[3];
                if (elsePart) {
                    if (thenPart[0] == "block") {
                        this._both(" ");
                    } else {
                        this._bothLine("")
                            ._bothIndents();
                    }

                    if (elsePart[0] == "if") {
                        this._both("else ")._visitRaw(elsePart);
                    } else {
                        this._both("else ")._visitRawBody(elsePart);
                    }
                }
            },

            "break": function (ast) {
                if (this._pos.inLoop || this._pos.inSwitch) {
                    this._both("break;");
                } else {
                    this._code("return ")._visitWind({ type: "break", stmt: ast })._code(";");
                }
            },

            "continue": function (ast) {
                if (this._pos.inLoop) {
                    this._both("continue;");
                } else {
                    this._code("return ")._visitWind({ type: "continue", stmt: ast })._code(";");
                }
            },

            "return": function (ast) {
                if (this._pos.inFunction) {
                    this._both("return");
                    var value = ast[1];
                    if (value) this._both(" ")._visitRaw(value);
                    this._both(";");
                } else {
                    this._code("return ")._visitWind({ type: "return", stmt: ast })._code(";");
                }
            },

            "throw": function (ast) {
                var pos = this._pos;
                if (pos.inTry || pos.inFunction) {
                    this._both("throw ")._visitRaw(ast[1])._both(";");
                } else {
                    this._code("return ")._visitWind({ type: "throw", stmt: ast })._code(";");
                }
            },

            "conditional": function (ast) {
                this._both("(")._visitRaw(ast[1])._both(") ? (")._visitRaw(ast[2])._both(") : (")._visitRaw(ast[3])._both(")");
            },

            "try": function (ast) {

                this._bothLine("try {");
                this._bothIndentLevel(1);

                var currInTry = this._pos.inTry;
                this._pos.inTry = true;

                this._visitRawStatements(ast[1]);
                this._bothIndentLevel(-1);

                this._pos.inTry = currInTry;

                var catchClause = ast[2];
                var finallyStatements = ast[3];

                if (catchClause) {
                    this._bothIndents()
                        ._bothLine("} catch (" + catchClause[0] + ") {")
                    this._bothIndentLevel(1);

                    this._visitRawStatements(catchClause[1]);
                    this._bothIndentLevel(-1);
                }

                if (finallyStatements) {
                    this._bothIndents()
                        ._bothLine("} finally {");
                    this._bothIndentLevel(1);

                    this._visitRawStatements(finallyStatements);
                    this._bothIndentLevel(-1);
                }                

                this._bothIndents()
                    ._both("}");
            },

            "switch": function (ast) {
                this._both("switch (")._visitRaw(ast[1])._bothLine(") {");
                this._bothIndentLevel(1);

                var currInSwitch = this._pos.inSwitch;
                this._pos.inSwitch = true;

                var cases = ast[2];
                for (var i = 0; i < cases.length; i++) {
                    var c = cases[i];
                    this._bothIndents();

                    if (c[0]) {
                        this._both("case ")._visitRaw(c[0])._bothLine(":");
                    } else {
                        this._bothLine("default:");
                    }
                    this._bothIndentLevel(1);

                    this._visitRawStatements(c[1]);
                    this._bothIndentLevel(-1);
                }
                this._bothIndentLevel(-1);

                this._pos.inSwitch = currInSwitch;

                this._bothIndents()
                    ._both("}");
            }
        }
    };
    
    var merge = function (commentLines, codeLines) {
        var length = commentLines.length;
        
        var maxShift = 0;
        
        for (var i = 0; i < length; i++) {
            var matches = codeLines[i].match(" +");
            var spaceLength = matches ? matches[0].length : 0;
            
            var shift = commentLines[i].length - spaceLength + 10;
            if (shift > maxShift) {
                maxShift = shift;
            }
        }
        
        var shiftBuffer = new Array(maxShift);
        for (var i = 0; i < maxShift; i++) {
            shiftBuffer[i] = " ";
        }
        
        var shiftSpaces = shiftBuffer.join("");

        var buffer = [];
        for (var i = 0; i < length; i++) {
            var comment = commentLines[i]; 
            if (comment.replace(/ +/g, "").length > 0) {
                comment = "/* " + comment + " */   ";
            }
            
            var code = shiftSpaces + codeLines[i];
            
            buffer.push(comment);
            buffer.push(code.substring(comment.length));
            buffer.push("\n");
        }
        
        return buffer.join("");
    }
    
    var compile = function (builderName, func, separateCodeAndComment) {
        var funcCode = func.toString();
        var evalCode = "eval(" + compile.rootName + ".compile(" + stringify(builderName) + ", " + funcCode + "))"
        var evalCodeAst = Wind.parse(evalCode);

        var codeWriter = new CodeWriter();
        var commentWriter = new CodeWriter();
        
        // [ "toplevel", [ [ "stat", [ "call", ... ] ] ] ]
        var evalAst = evalCodeAst[1][0][1];
        compileWindPattern(evalAst, new SeedProvider(), codeWriter, commentWriter);
 
        if (separateCodeAndComment) {
            return {
                code: codeWriter.lines.join("\n"),
                codeLines: codeWriter.lines,
                comment: commentWriter.lines.join("\n"),
                commentLines: commentWriter.lines
            };
        } else {
            var newCode = merge(commentWriter.lines, codeWriter.lines);
            Wind.logger.debug("// Original: \r\n" + funcCode + "\r\n\r\n// Windified: \r\n" + newCode + "\r\n");
            
            return codeGenerator(newCode);
        }
    }

    compile.rootName = "Wind";

    // CommonJS
    var isCommonJS = !!(typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommonJS AMD
    var isAmd = !!(typeof require === "function" && typeof define === "function" && define.amd);

    var defineModule = function () {
        Wind.define({
            name: "jit",
            version: "0.6.6",
            exports: isCommonJS && module.exports,
            require: isCommonJS && require,
            autoloads: [ "parser" ],
            dependencies: { parser: "~0.6.5" },
            init: function () {
                Wind.compile = compile;
            }
        });
    }

    if (isCommonJS) {
        try {
            Wind = require("./wind");
        } catch (ex) {
            Wind = require("wind");
        }
        
        defineModule();
    } else if (isAmd) {
        require(["wind"], function (wind) {
            Wind = wind;
            defineModule();
        });
    } else {
        var Fn = Function, global = Fn('return this')();
        if (!global.Wind) {
            throw new Error('Missing the root object, please load "wind" component first.');
        }
        
        Wind = global.Wind;
        defineModule();
    }
})();
